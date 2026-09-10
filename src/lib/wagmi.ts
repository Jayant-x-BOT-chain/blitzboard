import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Define Botchain Testnet chain
export const botchainTestnet = defineChain({
  id: 968, 
  name: 'Botchain Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Botchain Testnet',
    symbol: 'BOT',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.bohr.life'],
    },
    public: {
      http: ['https://rpc.bohr.life'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Botchain Testnet Explorer',
      url: 'https://scan.bohr.life',
    },
  },
  testnet: true,
});

// Define Botchain chain
// export const botchain = defineChain({
//   id: 677, 
//   name: 'Botchain',
//   nativeCurrency: {
//     decimals: 18,
//     name: 'Botchain',
//     symbol: 'BOT',
//   },
//   rpcUrls: {
//     default: {
//       http: ['https://rpc.botchain.ai'],
//     },
//     public: {
//       http: ['https://rpc.botchain.ai'],
//     },
//   },
//   blockExplorers: {
//     default: {
//       name: 'Botchain Explorer',
//       url: 'https://scan.botchain.ai',
//     },
//   },
//   testnet: false,
// });

// Configure wagmi with RainbowKit
export const config = getDefaultConfig({
  appName: 'BlitzBoard',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'development',
  chains: [botchainTestnet, mainnet, sepolia], // Removed botchain mainnet for now
  ssr: false,
});

// Export chain configurations for easy access
export const supportedChains = {
  botchainTestnet,
  // botchain,
  mainnet,
  sepolia,
};

// Target chain for the app (Testnet for now, ready for mainnet)
export const TARGET_CHAIN_ID = botchainTestnet.id;
