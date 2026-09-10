// Agent voting runner - parallel execution on Monad
// Run with: node scripts/agent-runner.cjs <eventId>
// Or test mode: node scripts/agent-runner.cjs --test

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Configuration
const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";

// Supabase client for reading submissions & registering wallets
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Minimal ABI for voting
const ABI = [
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
    "event VoteCast(address indexed voter, string indexed eventId, string submissionId, uint256 votes)",
    "event VotesSubmitted(address indexed voter, string indexed eventId, uint256 totalCreditsUsed, uint256 timestamp)"
];

// Deterministic scoring heuristics (no LLM required)
const SCORING_HEURISTICS = {
    hasDescription: (s) => (s.description?.length > 100 ? 2 : 0),
    hasProjectLink: (s) => (s.projectLink ? 3 : 0),
    titleQuality: (s) => (s.title?.length > 10 ? 1 : 0),
    hasMultipleFeatures: (s) => (s.description?.includes("and") ? 1 : 0),
};

const CREDITS_PER_VOTER = 100;

function calculateScore(submission) {
    let score = 0;
    for (const [name, fn] of Object.entries(SCORING_HEURISTICS)) {
        score += fn(submission);
    }
    return score;
}

function distributeVotes(submissions, credits) {
    // Calculate scores
    const scored = submissions.map((s, i) => ({
        index: i,
        submissionId: s.id,
        score: calculateScore(s)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Allocate votes using quadratic budget
    const allocations = [];
    let remainingCredits = credits;

    for (const item of scored) {
        if (remainingCredits <= 0) break;

        // Max votes we can give = sqrt(remaining credits)
        const maxVotes = Math.floor(Math.sqrt(remainingCredits));
        // Give votes proportional to score (1-5 range)
        const votes = Math.min(maxVotes, Math.max(1, Math.min(5, item.score)));
        const cost = votes * votes;

        if (cost <= remainingCredits) {
            allocations.push({
                submissionId: item.submissionId,
                voteCount: votes
            });
            remainingCredits -= cost;
        }
    }

    return allocations;
}

async function runAgentVoting(eventId, submissions) {
    console.log("🤖 Starting parallel agent voting...\n");

    // Load wallets
    const walletsPath = path.join(__dirname, "agent-wallets.json");
    if (!fs.existsSync(walletsPath)) {
        console.log("❌ No wallets found. Run: node scripts/generate-wallets.cjs");
        process.exit(1);
    }

    const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
    console.log(`📋 Loaded ${wallets.length} agent wallets`);

    // Register wallets in Supabase agent_wallets table
    await ensureWalletsRegistered(wallets);

    // Connect to Monad
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // Metrics
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    const txHashes = [];

    // Run agents in parallel
    const votePromises = wallets.map(async (walletData, index) => {
        try {
            const wallet = new ethers.Wallet(walletData.privateKey, provider);
            const connectedContract = contract.connect(wallet);

            // Check if already voted
            const hasVoted = await connectedContract.hasVoterVoted(wallet.address, eventId);
            if (hasVoted) {
                console.log(`⏭️  Agent ${index + 1}: Already voted`);
                skipCount++;
                return { success: false, reason: "already_voted" };
            }

            // Calculate vote allocations
            const allocations = distributeVotes(submissions, CREDITS_PER_VOTER);

            if (allocations.length === 0) {
                console.log(`⚠️  Agent ${index + 1}: No valid allocations`);
                return { success: false, reason: "no_allocations" };
            }

            // Submit votes on-chain (parallel with other agents via sharded storage!)
            const tx = await connectedContract.submitVotes(
                eventId,
                allocations.map(a => a.submissionId),
                allocations.map(a => a.voteCount)
            );

            console.log(`✅ Agent ${index + 1}: TX sent - ${tx.hash}`);
            txHashes.push(tx.hash);

            // Wait for confirmation
            const receipt = await tx.wait();
            successCount++;

            // Record in Supabase for the hybrid leaderboard
            await recordAgentVotes(
                eventId,
                wallet.address,
                allocations,
                tx.hash,
                receipt?.blockNumber || null
            );

            return { success: true, txHash: tx.hash };
        } catch (err) {
            failCount++;
            console.log(`❌ Agent ${index + 1}: ${err.message?.slice(0, 80)}`);
            return { success: false, error: err.message };
        }
    });

    // Wait for all agents to complete
    const results = await Promise.all(votePromises);
    const endTime = Date.now();

    // Calculate metrics
    const duration = (endTime - startTime) / 1000;
    const tps = successCount / duration;

    console.log("\n" + "=".repeat(50));
    console.log("📊 PARALLEL VOTING RESULTS");
    console.log("=".repeat(50));
    console.log(`✅ Successful votes: ${successCount}`);
    console.log(`⏭️  Skipped (already voted): ${skipCount}`);
    console.log(`❌ Failed votes: ${failCount}`);
    console.log(`⏱️  Total time: ${duration.toFixed(2)}s`);
    console.log(`🚀 Throughput: ${tps.toFixed(2)} votes/second`);
    if (supabase) {
        console.log(`📝 Agent votes recorded in Supabase: ✅`);
    }
    console.log("=".repeat(50));

    return {
        successCount,
        failCount,
        duration,
        tps,
        txHashes
    };
}

// =====================================================
// SUPABASE HELPERS
// =====================================================

/**
 * Fetch real submissions from Supabase for an event
 */
async function fetchSubmissions(eventId) {
    if (!supabase) {
        console.error("❌ Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
        return null;
    }

    const { data, error } = await supabase
        .from("submissions")
        .select("id, project_title, description, project_link")
        .eq("event_id", eventId);

    if (error) {
        console.error("❌ Error fetching submissions:", error.message);
        return null;
    }

    if (!data || data.length === 0) {
        console.log("⚠️  No submissions found for this event");
        return null;
    }

    // Map to the shape the scoring/voting functions expect
    return data.map(s => ({
        id: s.id,
        title: s.project_title,
        description: s.description || "",
        projectLink: s.project_link || null,
    }));
}

/**
 * Record agent votes into Supabase agent_votes table
 */
async function recordAgentVotes(eventId, agentAddress, allocations, txHash, blockNumber) {
    if (!supabase) return;

    const records = allocations.map(a => ({
        event_id: eventId,
        submission_id: a.submissionId,
        agent_address: agentAddress.toLowerCase(),
        vote_count: a.voteCount,
        vote_cost: a.voteCount * a.voteCount,
        tx_hash: txHash || null,
        block_number: blockNumber || null,
    }));

    const { error } = await supabase
        .from("agent_votes")
        .upsert(records, { onConflict: "event_id,submission_id,agent_address" });

    if (error) {
        console.error(`⚠️  Error recording votes for ${agentAddress}:`, error.message);
    }
}

/**
 * Ensure agent wallets are registered in Supabase
 */
async function ensureWalletsRegistered(wallets) {
    if (!supabase) return;

    const records = wallets.map(w => ({
        wallet_address: w.address.toLowerCase(),
        agent_index: w.index,
    }));

    const { error } = await supabase
        .from("agent_wallets")
        .upsert(records, { onConflict: "wallet_address" });

    if (error) {
        console.error("⚠️  Error registering wallets:", error.message);
    } else {
        console.log(`📝 Registered ${wallets.length} wallets in agent_wallets table`);
    }
}

// =====================================================
// MAIN ENTRY
// =====================================================

async function main() {
    const args = process.argv.slice(2);
    const isTestMode = args.includes("--test");
    const eventId = args.find(a => !a.startsWith("--")) || null;

    if (!eventId && !isTestMode) {
        console.log("Usage: node scripts/agent-runner.cjs <eventId>");
        console.log("       node scripts/agent-runner.cjs --test");
        process.exit(1);
    }

    // In test mode use mock data, otherwise fetch from Supabase
    let submissions;
    const resolvedEventId = eventId || "test-event-" + Date.now();

    if (isTestMode || !supabase) {
        console.log("🧪 Running in test mode with mock submissions");
        submissions = [
            { id: "sub-001", title: "DeFi Protocol", description: "A decentralized finance protocol with lending and borrowing features", projectLink: "https://github.com/test" },
            { id: "sub-002", title: "NFT Marketplace", description: "Buy and sell NFTs", projectLink: null },
            { id: "sub-003", title: "DAO Voting Tool", description: "Governance voting platform for DAOs with quadratic voting and delegation features", projectLink: "https://github.com/dao" },
            { id: "sub-004", title: "GameFi", description: "Play to earn game", projectLink: "https://gamefi.io" },
            { id: "sub-005", title: "Bridge Protocol", description: "Cross-chain bridge supporting multiple networks and token types with security features", projectLink: "https://bridge.xyz" },
        ];
    } else {
        console.log(`📡 Fetching submissions for event: ${resolvedEventId}`);
        submissions = await fetchSubmissions(resolvedEventId);
        if (!submissions) {
            process.exit(1);
        }
    }

    console.log(`\n📋 Event ID: ${resolvedEventId}`);
    console.log(`📦 Submissions: ${submissions.length}`);
    console.log(`🏦 Contract: ${CONTRACT_ADDRESS}\n`);

    await runAgentVoting(resolvedEventId, submissions);
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runAgentVoting, distributeVotes, calculateScore };
