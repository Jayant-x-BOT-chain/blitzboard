// Batch-fund all agent wallets with 0.5 MON each
// Run with: node scripts/fund-all-wallets.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://testnet-rpc.monad.xyz";
const FUND_AMOUNT = "0.5"; // MON per wallet

async function main() {
    const walletsPath = path.join(__dirname, "agent-wallets.json");
    if (!fs.existsSync(walletsPath)) {
        console.log("❌ No agent-wallets.json found. Run: node scripts/generate-wallets.cjs");
        process.exit(1);
    }

    const wallets = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployerKey = process.env.WALLET_PRIVATE_KEY;

    if (!deployerKey) {
        console.log("❌ No WALLET_PRIVATE_KEY in .env");
        process.exit(1);
    }

    const deployer = new ethers.Wallet(deployerKey, provider);
    const balance = await provider.getBalance(deployer.address);
    console.log(`💰 Deployer: ${deployer.address}`);
    console.log(`💰 Balance:  ${ethers.formatEther(balance)} MON`);
    console.log(`📋 Wallets:  ${wallets.length}`);
    console.log(`💸 Funding:  ${FUND_AMOUNT} MON each`);
    console.log(`💰 Total:    ${wallets.length * parseFloat(FUND_AMOUNT)} MON needed\n`);

    const fundAmount = ethers.parseEther(FUND_AMOUNT);
    const minBalance = ethers.parseEther("0.45"); // skip if already has ≥0.45

    let funded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        const bal = await provider.getBalance(w.address);

        if (bal >= minBalance) {
            console.log(`⏭️  [${i + 1}/${wallets.length}] ${w.address.slice(0, 12)}... already has ${ethers.formatEther(bal)} MON`);
            skipped++;
            continue;
        }

        try {
            const tx = await deployer.sendTransaction({
                to: w.address,
                value: fundAmount,
                gasLimit: 21000,
            });
            await tx.wait();
            funded++;
            console.log(`✅ [${i + 1}/${wallets.length}] ${w.address.slice(0, 12)}... funded with ${FUND_AMOUNT} MON`);
        } catch (err) {
            failed++;
            console.error(`❌ [${i + 1}/${wallets.length}] ${w.address.slice(0, 12)}... FAILED: ${err.message?.slice(0, 60)}`);
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Funded:  ${funded}`);
    console.log(`⏭️  Skipped: ${skipped} (already had ≥0.45 MON)`);
    console.log(`❌ Failed:  ${failed}`);
    console.log("=".repeat(50));

    const finalBalance = await provider.getBalance(deployer.address);
    console.log(`\n💰 Deployer remaining: ${ethers.formatEther(finalBalance)} MON`);
}

main().catch(console.error);
