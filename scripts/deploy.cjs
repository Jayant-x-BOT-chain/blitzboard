// Deploy script for AgentConsensus contract
// Run with: npx hardhat run scripts/deploy.cjs --network botchain

const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying AgentConsensus to Botchain...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📍 Deployer address:", await deployer.getAddress());

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Deployer balance:", hre.ethers.formatEther(balance), "BOT\n");

    // Deploy AgentConsensus
    const AgentConsensus = await hre.ethers.getContractFactory("AgentConsensus");
    console.log("📦 Deploying AgentConsensus...");

    const contract = await AgentConsensus.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();

    console.log("\n✅ AgentConsensus deployed!");
    console.log("📍 Contract address:", contractAddress);
    console.log("\n🔗 View on explorer:");
    console.log(`   https://scan.botchain.ai/address/${contractAddress}`);

    console.log("\n📝 Update src/lib/contract.ts with:");
    console.log(`   export const AGENT_CONSENSUS_ADDRESS = "${contractAddress}";`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
