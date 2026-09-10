// Quick test with single agent to verify contract works
// Run with: node scripts/quick-test.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";
const FUNDER_PRIVATE_KEY = process.env.VITE_WALLET_PRIVATE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const ABI = [
    "function createEvent(string eventId, string eventCode) external",
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
    "function getEventVoters(string eventId) external view returns (address[])",
    "function getVoterVotes(address voter, string eventId) external view returns (string[], uint256[], uint256[])",
    "function isEventActive(string eventId) external view returns (bool)"
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("🧪 Quick test - single agent vote\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get event from Supabase
    const { data: events } = await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(1);
    if (!events?.length) { console.log("❌ No events"); return; }

    const event = events[0];
    console.log(`📅 Event: ${event.id}`);
    console.log(`   Code: ${event.event_code}`);

    // Get submissions
    const { data: submissions } = await supabase.from('submissions').select('*').eq('event_id', event.id);
    console.log(`📦 Submissions: ${submissions?.length || 0}`);

    if (!submissions?.length) { console.log("❌ No submissions"); return; }

    // Use funder wallet directly for this test
    const wallet = new ethers.Wallet(FUNDER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    console.log(`\n👛 Wallet: ${wallet.address}`);

    // Check if already voted
    const hasVoted = await contract.hasVoterVoted(wallet.address, event.id);
    console.log(`🗳️  Has voted: ${hasVoted}`);

    if (hasVoted) {
        // Read existing votes
        const [subIds, counts, costs] = await contract.getVoterVotes(wallet.address, event.id);
        console.log("\n📊 Existing votes:");
        for (let i = 0; i < subIds.length; i++) {
            const sub = submissions.find(s => s.id === subIds[i]);
            console.log(`   ${sub?.project_title || subIds[i]}: ${counts[i]} votes`);
        }

        // Check voters
        const voters = await contract.getEventVoters(event.id);
        console.log(`\n📋 Total voters: ${voters.length}`);

        console.log("\n✅ Contract is working! Votes already recorded.");
        return;
    }

    // Submit vote
    console.log("\n📤 Submitting votes...");

    const submissionIds = submissions.slice(0, 2).map(s => s.id);
    const voteCounts = [3, 2]; // 9 + 4 = 13 credits

    console.log(`   Voting for: ${submissionIds.length} submissions`);
    console.log(`   Votes: [${voteCounts.join(', ')}]`);

    try {
        const tx = await contract.submitVotes(event.id, submissionIds, voteCounts, { gasLimit: 500000 });
        console.log(`   TX: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);

        // Verify
        const [subIds, counts, costs] = await contract.getVoterVotes(wallet.address, event.id);
        console.log("\n📊 Recorded votes:");
        for (let i = 0; i < subIds.length; i++) {
            const sub = submissions.find(s => s.id === subIds[i]);
            console.log(`   ${sub?.project_title || subIds[i]}: ${counts[i]} votes`);
        }

        console.log("\n🎉 SUCCESS! Vote recorded on-chain.");
        console.log(`\n🔗 View TX: https://testnet.monadexplorer.com/tx/${tx.hash}`);

    } catch (err) {
        console.log(`   ❌ Failed: ${err.message}`);
    }
}

main().catch(console.error);
