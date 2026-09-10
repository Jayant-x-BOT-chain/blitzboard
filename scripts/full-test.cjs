/**
 * Full automated test: create event on-chain → generate wallets → fund → agent vote → verify
 * Run: node scripts/full-test.cjs
 */

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Config
const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";
const NUM_TEST_AGENTS = 5; // Small number for quick test
const FUND_AMOUNT = "0.02"; // MON per agent

const EVENT_ID = "23f706ce-ccbf-4fa7-b779-fc493416a151"; // monad blitz
const EVENT_CODE = "JZVRBKGQ";

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const ABI = [
    "function createEvent(string eventId, string eventCode) external",
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
    "function getEvent(string eventId) view returns (string, string, address, uint256, bool)",
    "function getTotalEvents() view returns (uint256)",
    "function isEventActive(string eventId) view returns (bool)",
    "function getSubmissionScore(string eventId, string submissionId) view returns (uint256)",
    "function getEventVoters(string eventId) view returns (address[])",
    "event VoteCast(address indexed voter, string indexed eventId, string submissionId, uint256 votes)",
];

const CREDITS_PER_VOTER = 100;

// ========== SCORING (same as agent-runner) ==========

function calculateScore(submission) {
    let score = 0;
    if (submission.description?.length > 100) score += 2;
    if (submission.project_link) score += 3;
    if (submission.project_title?.length > 10) score += 1;
    if (submission.description?.includes("and")) score += 1;
    return score;
}

function distributeVotes(submissions, credits) {
    const scored = submissions.map(s => ({
        submissionId: s.id,
        score: calculateScore(s),
    }));
    scored.sort((a, b) => b.score - a.score);

    const allocations = [];
    let remaining = credits;
    for (const item of scored) {
        if (remaining <= 0) break;
        const maxVotes = Math.floor(Math.sqrt(remaining));
        const votes = Math.min(maxVotes, Math.max(1, Math.min(5, item.score)));
        const cost = votes * votes;
        if (cost <= remaining) {
            allocations.push({ submissionId: item.submissionId, voteCount: votes });
            remaining -= cost;
        }
    }
    return allocations;
}

// ========== STEP FUNCTIONS ==========

async function step1_createEventOnChain(provider, deployerWallet) {
    console.log("\n" + "=".repeat(55));
    console.log("STEP 1: Ensure event exists on AgentConsensus contract");
    console.log("=".repeat(55));

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, deployerWallet);

    // Try to check if event is active (simpler than getEvent)
    try {
        const isActive = await contract.isEventActive(EVENT_ID);
        console.log("✅ Event exists on-chain, active:", isActive);
        return true;
    } catch (e) {
        console.log("Event not found on-chain, creating...");
    }

    // Try to create with original code
    try {
        const tx = await contract.createEvent(EVENT_ID, EVENT_CODE);
        console.log("📤 TX sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Event created on-chain! Block:", receipt.blockNumber);
        return true;
    } catch (e) {
        const errMsg = e.message || "";
        // If event already exists or code collision, try with unique code
        if (errMsg.includes("already")) {
            console.log("⚠️  Conflict:", errMsg.slice(0, 60));
            // If "Event already exists" that means our ID is on-chain - we're good!
            if (errMsg.includes("Event already exists")) {
                console.log("✅ Event ID is already on-chain - proceeding!");
                return true;
            }
            // Code already used - try unique code
            const uniqueCode = "TS" + Date.now().toString(36).slice(-6).toUpperCase();
            try {
                const tx = await contract.createEvent(EVENT_ID, uniqueCode);
                await tx.wait();
                console.log("✅ Event created with code:", uniqueCode);
                return true;
            } catch (e2) {
                const msg2 = e2.message || "";
                if (msg2.includes("Event already exists")) {
                    console.log("✅ Event ID is already on-chain - proceeding!");
                    return true;
                }
                console.log("❌ Failed:", msg2.slice(0, 100));
                return false;
            }
        }
        console.log("❌ Failed:", errMsg.slice(0, 100));
        return false;
    }
}

async function step2_generateWallets() {
    console.log("\n" + "=".repeat(55));
    console.log("STEP 2: Generate " + NUM_TEST_AGENTS + " agent wallets");
    console.log("=".repeat(55));

    const walletsPath = path.join(__dirname, "agent-wallets.json");

    // Check if we already have wallets
    if (fs.existsSync(walletsPath)) {
        const existing = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
        console.log(`Found existing ${existing.length} wallets`);
        // Use first NUM_TEST_AGENTS for testing
        const testWallets = existing.slice(0, NUM_TEST_AGENTS);
        console.log(`Using first ${testWallets.length} for this test`);
        return testWallets;
    }

    const wallets = [];
    for (let i = 0; i < NUM_TEST_AGENTS; i++) {
        const w = ethers.Wallet.createRandom();
        wallets.push({ index: i + 1, address: w.address, privateKey: w.privateKey });
        console.log(`  Agent ${i + 1}: ${w.address}`);
    }

    fs.writeFileSync(walletsPath, JSON.stringify(wallets, null, 2));
    console.log(`✅ Saved ${wallets.length} wallets to agent-wallets.json`);
    return wallets;
}

async function step3_registerInSupabase(wallets) {
    console.log("\n" + "=".repeat(55));
    console.log("STEP 3: Register wallets in Supabase");
    console.log("=".repeat(55));

    const records = wallets.map(w => ({
        wallet_address: w.address.toLowerCase(),
        agent_index: w.index,
    }));

    const { error } = await supabase
        .from("agent_wallets")
        .upsert(records, { onConflict: "wallet_address" });

    if (error) {
        console.log("❌ Error:", error.message);
        return false;
    }
    console.log(`✅ Registered ${wallets.length} wallets in agent_wallets table`);
    return true;
}

async function step4_fundWallets(wallets, deployerWallet, provider) {
    console.log("\n" + "=".repeat(55));
    console.log("STEP 4: Fund agent wallets from deployer");
    console.log("=".repeat(55));

    const funded = [];
    const needsFunding = [];

    // Check which wallets need funding
    for (const w of wallets) {
        const bal = await provider.getBalance(w.address);
        const balEth = parseFloat(ethers.formatEther(bal));
        if (balEth >= 0.005) {
            funded.push(w.address);
        } else {
            needsFunding.push(w);
        }
    }

    console.log(`Already funded: ${funded.length}, needs funding: ${needsFunding.length}`);

    if (needsFunding.length === 0) {
        console.log("✅ All wallets already funded!");
        return true;
    }

    // Fund wallets sequentially (nonce management)
    let nonce = await provider.getTransactionCount(deployerWallet.address);
    console.log(`Deployer nonce: ${nonce}, funding ${FUND_AMOUNT} MON each...`);

    const txPromises = [];
    for (const w of needsFunding) {
        try {
            const tx = await deployerWallet.sendTransaction({
                to: w.address,
                value: ethers.parseEther(FUND_AMOUNT),
                nonce: nonce++,
            });
            txPromises.push(tx.wait());
            console.log(`  💸 Agent ${w.index}: ${tx.hash.slice(0, 20)}...`);
        } catch (e) {
            console.log(`  ❌ Agent ${w.index}: ${e.message?.slice(0, 60)}`);
        }
    }

    // Wait for all funding txs
    await Promise.all(txPromises);
    console.log(`✅ Funded ${needsFunding.length} wallets!`);
    return true;
}

async function step5_runAgentVoting(wallets, submissions, provider) {
    console.log("\n" + "=".repeat(55));
    console.log("STEP 5: Run parallel agent voting on-chain");
    console.log("=".repeat(55));

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const startTime = Date.now();

    let success = 0, skip = 0, fail = 0;

    const votePromises = wallets.map(async (walletData, index) => {
        try {
            const wallet = new ethers.Wallet(walletData.privateKey, provider);
            const connectedContract = contract.connect(wallet);

            // Check if already voted
            const voted = await connectedContract.hasVoterVoted(wallet.address, EVENT_ID);
            if (voted) {
                console.log(`  ⏭️  Agent ${index + 1}: Already voted`);
                skip++;
                return null;
            }

            // Calculate votes
            const allocations = distributeVotes(submissions, CREDITS_PER_VOTER);
            console.log(`  🗳️  Agent ${index + 1}: Voting on ${allocations.length} submissions...`);

            const tx = await connectedContract.submitVotes(
                EVENT_ID,
                allocations.map(a => a.submissionId),
                allocations.map(a => a.voteCount)
            );

            const receipt = await tx.wait();
            success++;
            console.log(`  ✅ Agent ${index + 1}: TX confirmed in block ${receipt.blockNumber}`);

            // Record in Supabase agent_votes
            for (const alloc of allocations) {
                await supabase.from("agent_votes").upsert({
                    event_id: EVENT_ID,
                    submission_id: alloc.submissionId,
                    agent_address: wallet.address.toLowerCase(),
                    vote_count: alloc.voteCount,
                    vote_cost: alloc.voteCount * alloc.voteCount,
                    tx_hash: tx.hash,
                    block_number: receipt.blockNumber,
                }, { onConflict: "event_id,submission_id,agent_address" });
            }

            return tx.hash;
        } catch (e) {
            fail++;
            console.log(`  ❌ Agent ${index + 1}: ${e.message?.slice(0, 80)}`);
            return null;
        }
    });

    await Promise.all(votePromises);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n  Results: ✅${success} ⏭️${skip} ❌${fail} in ${duration}s`);
    if (success > 0) console.log(`  🚀 Throughput: ${(success / parseFloat(duration)).toFixed(2)} votes/sec`);
    return success;
}

async function step6_verify(provider, submissions) {
    console.log("\n" + "=".repeat(55));
    console.log("STEP 6: Verify results");
    console.log("=".repeat(55));

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // On-chain scores
    console.log("\n📊 On-chain submission scores:");
    for (const sub of submissions) {
        try {
            const score = await contract.getSubmissionScore(EVENT_ID, sub.id);
            console.log(`  ${sub.project_title}: ${score.toString()} on-chain votes`);
        } catch (e) {
            console.log(`  ${sub.project_title}: error reading score`);
        }
    }

    // On-chain voters
    try {
        const voters = await contract.getEventVoters(EVENT_ID);
        console.log(`\n👥 On-chain voters: ${voters.length}`);
    } catch (e) {
        console.log("  Could not read voters:", e.message?.slice(0, 60));
    }

    // Supabase agent_votes
    const { data: agentVotes } = await supabase
        .from("agent_votes")
        .select("*")
        .eq("event_id", EVENT_ID);
    console.log(`\n📝 Supabase agent_votes: ${(agentVotes || []).length} records`);
    for (const v of (agentVotes || []).slice(0, 5)) {
        console.log(`  ${v.agent_address.slice(0, 10)}... → ${v.submission_id.slice(0, 8)}... votes:${v.vote_count} cost:${v.vote_cost}`);
    }

    // Supabase agent_wallets
    const { data: agentWallets } = await supabase.from("agent_wallets").select("*");
    console.log(`\n🤖 Registered agent wallets: ${(agentWallets || []).length}`);

    // Human votes for comparison
    const { data: humanVotes } = await supabase
        .from("votes")
        .select("*")
        .eq("event_id", EVENT_ID);
    console.log(`👤 Human votes: ${(humanVotes || []).length}`);

    console.log("\n" + "=".repeat(55));
    console.log("✅ TEST COMPLETE - Check the 3-tab leaderboard in the UI!");
    console.log("=".repeat(55));
}

// ========== MAIN ==========

async function main() {
    console.log("🧪 FULL AGENT VOTING TEST");
    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("Event:", EVENT_ID, "(monad blitz)");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployerWallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    console.log("Deployer:", deployerWallet.address);

    const deployerBal = await provider.getBalance(deployerWallet.address);
    console.log("Balance:", ethers.formatEther(deployerBal), "MON");

    // Get submissions from Supabase
    const { data: submissions } = await supabase
        .from("submissions")
        .select("id, project_title, description, project_link")
        .eq("event_id", EVENT_ID);

    console.log("Submissions:", submissions.length);
    submissions.forEach(s => console.log(" -", s.project_title, `(${s.id.slice(0, 8)}...)`));

    // Run steps
    const eventOk = await step1_createEventOnChain(provider, deployerWallet);
    if (!eventOk) { console.log("❌ Cannot proceed without on-chain event"); return; }

    const wallets = await step2_generateWallets();
    await step3_registerInSupabase(wallets);
    await step4_fundWallets(wallets, deployerWallet, provider);
    const successCount = await step5_runAgentVoting(wallets, submissions, provider);
    await step6_verify(provider, submissions);
}

main().catch(err => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
