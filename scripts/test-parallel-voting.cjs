// Complete test script for parallel agent voting
// Run with: node scripts/test-parallel-voting.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

// ==========================================
// CONFIGURATION
// ==========================================

const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";
const FUNDER_PRIVATE_KEY = process.env.VITE_WALLET_PRIVATE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Number of agents to test with
const NUM_AGENTS = 10; // Start small, can increase

// Amount to fund each agent (in MON)
const FUND_AMOUNT = "0.01";

// Contract ABI (minimal)
const ABI = [
    "function createEvent(string eventId, string eventCode) external",
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
    "function getEventVoters(string eventId) external view returns (address[])",
    "function isEventActive(string eventId) external view returns (bool)",
    "event VoteCast(address indexed voter, string indexed eventId, string submissionId, uint256 votes)",
    "event VotesSubmitted(address indexed voter, string indexed eventId, uint256 totalCreditsUsed, uint256 timestamp)"
];

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// STEP 0: Ensure event exists on-chain
// ==========================================

async function ensureEventOnChain(eventId, eventCode, provider) {
    console.log("\n🔗 STEP 0: Ensuring event exists on-chain...\n");

    const funderWallet = new ethers.Wallet(FUNDER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, funderWallet);

    try {
        // Check if event already exists
        const isActive = await contract.isEventActive(eventId);
        console.log(`   ✅ Event already exists on-chain (active: ${isActive})`);
        return true;
    } catch (err) {
        // Event doesn't exist, create it
        console.log(`   📝 Event not on-chain, creating...`);
        try {
            const tx = await contract.createEvent(eventId, eventCode);
            console.log(`   📤 TX sent: ${tx.hash}`);
            await tx.wait();
            console.log(`   ✅ Event created on-chain!`);
            return true;
        } catch (createErr) {
            console.log(`   ❌ Create failed: ${createErr.message?.slice(0, 80)}`);
            return false;
        }
    }
}

// ==========================================
// STEP 1: Get existing event and submissions
// ==========================================

async function getEventAndSubmissions() {
    console.log("\n📋 STEP 1: Fetching event and submissions from Supabase...\n");

    // Get events
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (eventError || !events?.length) {
        console.log("❌ No events found:", eventError?.message);
        return null;
    }

    const event = events[0];
    console.log(`📅 Event: ${event.title}`);
    console.log(`   ID: ${event.id}`);
    console.log(`   Code: ${event.event_code}`);

    // Get submissions for this event
    const { data: submissions, error: subError } = await supabase
        .from('submissions')
        .select('*')
        .eq('event_id', event.id);

    if (subError) {
        console.log("❌ Error fetching submissions:", subError.message);
        return null;
    }

    console.log(`\n📦 Found ${submissions.length} submissions:`);
    submissions.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.project_title} (${s.id.slice(0, 8)}...)`);
    });

    return { event, submissions };
}

// ==========================================
// STEP 2: Generate and fund agent wallets
// ==========================================

async function generateAndFundAgents(provider, numAgents) {
    console.log(`\n💰 STEP 2: Generating and funding ${numAgents} agent wallets...\n`);

    const funderWallet = new ethers.Wallet(FUNDER_PRIVATE_KEY, provider);
    const funderBalance = await provider.getBalance(funderWallet.address);
    console.log(`💳 Funder: ${funderWallet.address}`);
    console.log(`💰 Funder balance: ${ethers.formatEther(funderBalance)} MON\n`);

    const agents = [];
    const fundAmount = ethers.parseEther(FUND_AMOUNT);

    for (let i = 0; i < numAgents; i++) {
        // Generate wallet
        const wallet = ethers.Wallet.createRandom().connect(provider);

        // Fund it
        try {
            const tx = await funderWallet.sendTransaction({
                to: wallet.address,
                value: fundAmount
            });
            await tx.wait();
            console.log(`   ✅ Agent ${i + 1}: ${wallet.address} funded with ${FUND_AMOUNT} MON`);
            agents.push(wallet);
        } catch (err) {
            console.log(`   ❌ Agent ${i + 1}: Funding failed - ${err.message?.slice(0, 50)}`);
        }
    }

    console.log(`\n✅ Funded ${agents.length} agents`);
    return agents;
}

// ==========================================
// STEP 3: Run parallel voting
// ==========================================

function calculateVoteAllocations(submissions) {
    // Simple heuristic scoring
    const scored = submissions.map(s => ({
        id: s.id,
        score: (s.description?.length > 50 ? 3 : 1) +
            (s.project_link ? 2 : 0) +
            (s.project_title?.length > 10 ? 1 : 0)
    }));

    // Sort by score and allocate votes
    scored.sort((a, b) => b.score - a.score);

    const allocations = [];
    let remainingCredits = 100;

    for (const item of scored) {
        if (remainingCredits <= 0) break;

        const votes = Math.min(
            Math.floor(Math.sqrt(remainingCredits)),
            Math.max(1, Math.min(4, item.score))
        );

        const cost = votes * votes;
        if (cost <= remainingCredits) {
            allocations.push({ submissionId: item.id, voteCount: votes });
            remainingCredits -= cost;
        }
    }

    return allocations;
}

async function runParallelVoting(agents, eventId, submissions, provider) {
    console.log(`\n🗳️  STEP 3: Running parallel voting with ${agents.length} agents...\n`);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const startTime = Date.now();

    // Calculate allocations once (same for all agents in this test)
    const allocations = calculateVoteAllocations(submissions);
    console.log(`📊 Vote allocations:`);
    allocations.forEach(a => {
        const sub = submissions.find(s => s.id === a.submissionId);
        console.log(`   ${sub?.project_title?.slice(0, 30)}: ${a.voteCount} votes (cost: ${a.voteCount * a.voteCount})`);
    });
    console.log("");

    // Run agents in BATCHES of 3 to avoid RPC rate limiting
    const BATCH_SIZE = 3;
    const allResults = [];

    for (let i = 0; i < agents.length; i += BATCH_SIZE) {
        const batch = agents.slice(i, i + BATCH_SIZE);
        console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(agents.length / BATCH_SIZE)}...`);

        const batchPromises = batch.map(async (wallet, batchIndex) => {
            const index = i + batchIndex;
            try {
                const connectedContract = contract.connect(wallet);

                // Check if already voted
                const hasVoted = await connectedContract.hasVoterVoted(wallet.address, eventId);
                if (hasVoted) {
                    return { agent: index + 1, success: false, reason: "already_voted" };
                }

                // Submit votes with explicit gas limit
                const tx = await connectedContract.submitVotes(
                    eventId,
                    allocations.map(a => a.submissionId),
                    allocations.map(a => a.voteCount),
                    { gasLimit: 500000 }
                );

                console.log(`   🚀 Agent ${index + 1}: TX sent - ${tx.hash}`);

                const receipt = await tx.wait();
                return {
                    agent: index + 1,
                    success: true,
                    txHash: tx.hash,
                    blockNumber: receipt.blockNumber
                };
            } catch (err) {
                console.log(`   ❌ Agent ${index + 1}: ${err.message?.slice(0, 60)}`);
                return { agent: index + 1, success: false, error: err.message?.slice(0, 100) };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);

        // Small delay between batches
        if (i + BATCH_SIZE < agents.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Wait for ALL to complete
    const results = allResults;
    const endTime = Date.now();

    // Calculate metrics
    const successful = results.filter(r => r.success);
    const duration = (endTime - startTime) / 1000;
    const tps = successful.length / duration;

    // Check if votes landed in same block (parallel execution proof)
    const blocks = [...new Set(successful.map(r => r.blockNumber).filter(Boolean))];

    console.log("\n" + "=".repeat(60));
    console.log("📊 PARALLEL VOTING RESULTS");
    console.log("=".repeat(60));
    console.log(`✅ Successful votes: ${successful.length}/${agents.length}`);
    console.log(`⏱️  Total time: ${duration.toFixed(2)}s`);
    console.log(`🚀 Throughput: ${tps.toFixed(2)} votes/second`);
    console.log(`📦 Blocks used: ${blocks.length} (${blocks.join(', ')})`);

    if (blocks.length === 1) {
        console.log(`\n🎉 ALL VOTES IN SAME BLOCK - PARALLEL EXECUTION CONFIRMED!`);
    } else if (blocks.length <= 2) {
        console.log(`\n✨ Votes spread across ${blocks.length} blocks - near-parallel execution`);
    }

    console.log("=".repeat(60));

    return { results, successful, duration, tps, blocks };
}

// ==========================================
// STEP 4: Verify on-chain state
// ==========================================

async function verifyOnChainState(eventId, provider) {
    console.log("\n🔍 STEP 4: Verifying on-chain state...\n");

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        const voters = await contract.getEventVoters(eventId);
        console.log(`📋 Total voters on-chain: ${voters.length}`);

        if (voters.length > 0) {
            console.log(`\n   First 5 voters:`);
            voters.slice(0, 5).forEach((v, i) => {
                console.log(`   ${i + 1}. ${v}`);
            });
        }

        console.log(`\n🔗 View on explorer:`);
        console.log(`   https://testnet.monadexplorer.com/address/${CONTRACT_ADDRESS}`);

    } catch (err) {
        console.log("❌ Error reading state:", err.message);
    }
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    console.log("=".repeat(60));
    console.log("🤖 AGENT CONSENSUS - PARALLEL VOTING TEST");
    console.log("=".repeat(60));

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Step 1: Get event and submissions
    const data = await getEventAndSubmissions();
    if (!data) {
        console.log("\n❌ Cannot proceed without event data");
        return;
    }

    if (data.submissions.length < 2) {
        console.log("\n⚠️  Need at least 2 submissions to test voting");
        console.log("   Add more projects through the UI first");
        return;
    }

    // Step 1.5: Ensure event exists on-chain
    const eventOnChain = await ensureEventOnChain(data.event.id, data.event.event_code, provider);
    if (!eventOnChain) {
        console.log("\n❌ Cannot proceed - event not on-chain");
        return;
    }

    // Step 2: Generate and fund agents
    const agents = await generateAndFundAgents(provider, NUM_AGENTS);
    if (agents.length === 0) {
        console.log("\n❌ No agents funded");
        return;
    }

    // Short delay to ensure funding txs are confirmed
    console.log("\n⏳ Waiting 2s for funding confirmations...");
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Run parallel voting
    const votingResults = await runParallelVoting(
        agents,
        data.event.id,
        data.submissions,
        provider
    );

    // Step 4: Verify on-chain
    await verifyOnChainState(data.event.id, provider);

    console.log("\n🏁 Test complete! Check your frontend leaderboard.\n");
}

main().catch(console.error);
