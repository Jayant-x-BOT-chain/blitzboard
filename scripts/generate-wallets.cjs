// Generate agent wallets for parallel voting
// Run with: node scripts/generate-wallets.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Optional: register wallets in Supabase agent_wallets table
let supabase = null;
try {
    const { createClient } = require("@supabase/supabase-js");
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (url && key) {
        supabase = createClient(url, key);
    }
} catch (_) { /* supabase-js not installed, skip registration */ }

const NUM_AGENTS = 50;

async function main() {
    console.log(`🔧 Generating ${NUM_AGENTS} agent wallets...\n`);

    const wallets = [];

    for (let i = 0; i < NUM_AGENTS; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
            index: i + 1,
            address: wallet.address,
            privateKey: wallet.privateKey
        });
    }

    // Save to file
    const outputPath = path.join(__dirname, "agent-wallets.json");
    fs.writeFileSync(outputPath, JSON.stringify(wallets, null, 2));

    console.log(`✅ Generated ${NUM_AGENTS} wallets`);
    console.log(`📁 Saved to: ${outputPath}`);

    // Register in Supabase agent_wallets table
    if (supabase) {
        console.log("\n📝 Registering wallets in Supabase agent_wallets table...");
        const records = wallets.map(w => ({
            wallet_address: w.address.toLowerCase(),
            agent_index: w.index,
        }));

        const { error } = await supabase
            .from("agent_wallets")
            .upsert(records, { onConflict: "wallet_address" });

        if (error) {
            console.log(`⚠️  Could not register wallets in Supabase: ${error.message}`);
            console.log("   You can register them later when running agent-runner.cjs");
        } else {
            console.log(`✅ Registered ${NUM_AGENTS} wallets in agent_wallets table`);
        }
    } else {
        console.log("\n💡 Supabase not configured — wallets not registered in agent_wallets table.");
        console.log("   They will be auto-registered when you run agent-runner.cjs");
    }

    console.log("\n📋 Wallet addresses (for funding):");
    console.log("=".repeat(50));
    wallets.forEach(w => console.log(w.address));

    console.log("\n💡 To fund these wallets on Monad testnet:");
    console.log("   1. Use the Monad faucet for each address");
    console.log("   2. Or run the batch-fund script with a funded wallet");

    // Calculate total MON needed (estimate 0.01 MON per agent for gas)
    console.log(`\n💰 Estimated funding needed: ${NUM_AGENTS * 0.01} MON`);
}

main().catch(console.error);
