// Sequential voting test to avoid RPC rate limits
// Run with: node scripts/test-sequential.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";
const FUNDER_PRIVATE_KEY = process.env.VITE_WALLET_PRIVATE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const NUM_AGENTS = 5;
const FUND_AMOUNT = "0.01";

const ABI = [
    "function createEvent(string eventId, string eventCode) external",
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
    "function getEventVoters(string eventId) external view returns (address[])",
    "function isEventActive(string eventId) external view returns (bool)"
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("=".repeat(60));
    console.log("🤖 SEQUENTIAL VOTING TEST");
    console.log("=".repeat(60));

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const funderWallet = new ethers.Wallet(FUNDER_PRIVATE_KEY, provider);

    // Get event
    const { data: events } = await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(1);
    if (!events?.length) { console.log("❌ No events"); return; }
    const event = events[0];

    // Get submissions
    const { data: submissions } = await supabase.from('submissions').select('*').eq('event_id', event.id);
    console.log(`\n📅 Event: ${event.id.slice(0, 8)}...`);
    console.log(`📦 Submissions: ${submissions.length}`);

    // Check event on-chain
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    try {
        await contract.isEventActive(event.id);
        console.log("🔗 Event on-chain: ✅");
    } catch {
        console.log("❌ Event not on-chain");
        return;
    }

    // Generate and fund agents
    console.log(`\n💰 Generating ${NUM_AGENTS} agents...`);
    const agents = [];
    for (let i = 0; i < NUM_AGENTS; i++) {
        const wallet = ethers.Wallet.createRandom().connect(provider);
        const tx = await funderWallet.sendTransaction({
            to: wallet.address,
            value: ethers.parseEther(FUND_AMOUNT)
        });
        await tx.wait();
        agents.push(wallet);
        console.log(`   ✅ Agent ${i + 1}: ${wallet.address.slice(0, 10)}...`);
    }

    // Wait a bit
    console.log("\n⏳ Waiting 3s for confirmations...");
    await new Promise(r => setTimeout(r, 3000));

    // Vote sequentially
    console.log("\n🗳️  Voting sequentially...\n");
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < agents.length; i++) {
        const wallet = agents[i];
        const connectedContract = contract.connect(wallet);

        try {
            const tx = await connectedContract.submitVotes(
                event.id,
                submissions.slice(0, 2).map(s => s.id),
                [3, 2],
                { gasLimit: 500000 }
            );
            console.log(`   🚀 Agent ${i + 1}: TX ${tx.hash.slice(0, 10)}...`);

            const receipt = await tx.wait();
            results.push({ success: true, block: receipt.blockNumber });
            console.log(`   ✅ Agent ${i + 1}: Block ${receipt.blockNumber}`);
        } catch (err) {
            results.push({ success: false });
            console.log(`   ❌ Agent ${i + 1}: ${err.message?.slice(0, 50)}`);
        }

        // Small delay between votes
        await new Promise(r => setTimeout(r, 500));
    }

    const endTime = Date.now();
    const successful = results.filter(r => r.success);

    // Verify on-chain
    const voters = await contract.getEventVoters(event.id);

    console.log("\n" + "=".repeat(60));
    console.log("📊 RESULTS");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${successful.length}/${NUM_AGENTS}`);
    console.log(`⏱️  Duration: ${((endTime - startTime) / 1000).toFixed(1)}s`);
    console.log(`📋 Total voters on-chain: ${voters.length}`);
    console.log("=".repeat(60));

    console.log("\n🔗 View on explorer:");
    console.log(`   https://testnet.monadexplorer.com/address/${CONTRACT_ADDRESS}`);
}

main().catch(console.error);
