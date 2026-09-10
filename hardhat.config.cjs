require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");

const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || process.env.VITE_WALLET_PRIVATE_KEY || "";

// Debug: Check if key loaded
console.log("Private key loaded:", PRIVATE_KEY.length > 0 ? `${PRIVATE_KEY.length} chars` : "NO KEY FOUND");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        botchain: {
            url: "https://rpc.botchain.ai", // Replace with correct mainnet RPC if different
            chainId: 677, // Verify actual mainnet chainId
            accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
        },
        botchainTestnet: {
            url: "https://rpc.bohr.life",
            chainId: 968,
            accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
        }
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};
