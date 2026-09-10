// Fixed test with explicit nonce, legacy tx, and separate providers
// Run with: node scripts/test-fixed.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";
const FUNDER_PRIVATE_KEY = process.env.VITE_WALLET_PRIVATE_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const NUM_AGENTS = 5;
const FUND_AMOUNT = "0.1"; // Increased for gas at 102 gwei

const ABI = [
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
    "function getEventVoters(string eventId) external view returns (address[])"
];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("=".repeat(60));
    console.log("🔧 FIXED PARALLEL VOTING TEST");
    console.log("=".repeat(60));

    // Main provider for reads
    const mainProvider = new ethers.JsonRpcProvider(RPC_URL);
    const funderWallet = new ethers.Wallet(
        FUNDER_PRIVATE_KEY.startsWith('0x') ? FUNDER_PRIVATE_KEY : '0x' + FUNDER_PRIVATE_KEY,
        mainProvider
    );

    // Get event
    const { data: events } = await supabase.from('events').select('*').order('created_at', { ascending: false }).limit(1);
    if (!events?.length) { console.log("❌ No events"); return; }
    const event = events[0];

    // Get submissions
    const { data: submissions } = await supabase.from('submissions').select('*').eq('event_id', event.id);
    console.log(`\n📅 Event: ${event.id.slice(0, 8)}...`);
    console.log(`📦 Submissions: ${submissions.length}\n`);

    // Generate agents and fund them
    console.log(`💰 Generating and funding ${NUM_AGENTS} agents...\n`);
    const agents = [];

    for (let i = 0; i < NUM_AGENTS; i++) {
        const wallet = ethers.Wallet.createRandom();

        // Fund via funder wallet
        const fundTx = await funderWallet.sendTransaction({
            to: wallet.address,
            value: ethers.parseEther(FUND_AMOUNT),
            gasLimit: 21000
        });
        await fundTx.wait();

        console.log(`   ✅ Agent ${i + 1}: ${wallet.address}`);
        console.log(`      Funded: ${fundTx.hash.slice(0, 12)}...`);

        // Create SEPARATE provider for each agent (key fix!)
        const agentProvider = new ethers.JsonRpcProvider(RPC_URL);
        const connectedWallet = new ethers.Wallet(wallet.privateKey, agentProvider);

        agents.push({
            wallet: connectedWallet,
            address: wallet.address,
            provider: agentProvider
        });
    }

    // Wait for funding to settle
    console.log("\n⏳ Waiting 5s for funding confirmations...\n");
    await new Promise(r => setTimeout(r, 5000));

    // Get gas price
    const feeData = await mainProvider.getFeeData();
    const gasPrice = feeData.gasPrice;
    console.log(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei\n`);

    // Vote with each agent (staggered)
    console.log("🗳️  Voting (staggered)...\n");
    const startTime = Date.now();
    const results = [];

    for (let i = 0; i < agents.length; i++) {
        const { wallet, address, provider } = agents[i];

        try {
            // Get fresh nonce for this wallet
            const nonce = await provider.getTransactionCount(address, 'latest');
            console.log(`   Agent ${i + 1} nonce: ${nonce}`);

            // Create contract instance with agent's provider
            const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

            // Prepare transaction with LEGACY type and explicit parameters
            const tx = await contract.submitVotes(
                event.id,
                submissions.slice(0, 2).map(s => s.id),
                [3, 2],
                {
                    gasLimit: 500000,
                    gasPrice: gasPrice, // Explicit gas price (legacy tx)
                    nonce: nonce, // Explicit nonce
                    type: 0 // Legacy transaction type
                }
            );

            console.log(`   🚀 Agent ${i + 1}: TX ${tx.hash.slice(0, 12)}...`);

            const receipt = await tx.wait();
            results.push({ success: true, block: receipt.blockNumber, hash: tx.hash });
            console.log(`   ✅ Agent ${i + 1}: Block ${receipt.blockNumber}\n`);

        } catch (err) {
            console.log(`   ❌ Agent ${i + 1}: ${err.message?.slice(0, 80)}\n`);
            results.push({ success: false });
        }

        // Small delay between agents
        if (i < agents.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const endTime = Date.now();
    const successful = results.filter(r => r.success);

    // Verify on-chain
    console.log("📊 Verifying on-chain state...\n");
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, mainProvider);
    const voters = await contract.getEventVoters(event.id);

    console.log("=".repeat(60));
    console.log("📊 RESULTS");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${successful.length}/${NUM_AGENTS}`);
    console.log(`⏱️  Duration: ${((endTime - startTime) / 1000).toFixed(1)}s`);
    console.log(`📋 Total voters on-chain: ${voters.length}`);

    if (successful.length > 0) {
        console.log("\n🎉 VOTING WORKED!");
        console.log("\n📝 Transaction hashes:");
        successful.forEach((r, i) => {
            console.log(`   ${i + 1}. https://testnet.monadexplorer.com/tx/${r.hash}`);
        });
    }

    console.log("=".repeat(60));
}

main().catch(console.error);
