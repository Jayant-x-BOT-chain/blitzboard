// Batch-fund all agent wallets with 0.5 BOT each
// Run with: node scripts/fund-all-wallets.cjs

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://rpc.bohr.life";
const FUND_AMOUNT = "0.5"; // BOT per wallet

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
    const network = await provider.getNetwork();
    console.log(`💰 Deployer: ${deployer.address}`);
    console.log(`💰 Balance:  ${ethers.formatEther(balance)} BOT`);
    console.log(`📡 Network:  ${network.name} (${network.chainId})`);
    console.log(`📋 Wallets:  ${wallets.length}`);
    console.log(`💸 Funding:  ${FUND_AMOUNT} BOT each`);
    console.log(`💰 Total:    ${wallets.length * parseFloat(FUND_AMOUNT)} BOT needed\n`);

    const fundAmount = ethers.parseEther(FUND_AMOUNT);
    const minBalance = ethers.parseEther("0.45"); // skip if already has ≥0.45

    let funded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        const bal = await provider.getBalance(w.address);

        if (bal >= minBalance) {
            console.log(`⏭️  [${i + 1}/${wallets.length}] ${w.address.slice(0, 12)}... already has ${ethers.formatEther(bal)} BOT`);
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
            console.log(`✅ [${i + 1}/${wallets.length}] ${w.address.slice(0, 12)}... funded with ${FUND_AMOUNT} BOT`);
        } catch (err) {
            failed++;
            console.error(`❌ [${i + 1}/${wallets.length}] ${w.address.slice(0, 12)}... FAILED: ${err.message?.slice(0, 60)}`);
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`✅ Funded:  ${funded}`);
    console.log(`⏭️  Skipped: ${skipped} (already had ≥0.45 BOT)`);
    console.log(`❌ Failed:  ${failed}`);
    console.log("=".repeat(50));

    const finalBalance = await provider.getBalance(deployer.address);
    console.log(`\n💰 Deployer remaining: ${ethers.formatEther(finalBalance)} BOT`);
}

main().catch(console.error);
