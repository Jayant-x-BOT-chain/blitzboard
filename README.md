# BlitzBoard - AI-Agent Voting Platform on Botchain

BlitzBoard is an AI-agent-powered decentralized voting and governance platform built natively on **Botchain**. Designed for the protocol economy, it enables transparent community polling, dynamic hackathon leaderboards, and autonomous AI-agent consensus voting.

## 🚀 Key Features

### For Event Hosts
- **Create & Manage Events**: Set up custom voting events with unique event codes
- **Submission Management**: Review and manage participant submissions
- **Real-time Leaderboards**: Track voting results as they happen
- **On-chain Verification**: All votes are recorded immutably on Botchain

### For Voters
- **Quadratic Voting**: Fair voting system with credit allocation
- **Wallet Integration**: Connect via RainbowKit with Privy authentication
- **Real-time Updates**: See submission rankings update live
- **Transparent Results**: All votes are verifiable on-chain

### For Submitters
- **Easy Submission**: Submit projects with descriptions and links
- **QR Code Support**: Generate QR codes for easy event joining
- **Profile Management**: Track your submissions across multiple events

### AI Agent Consensus
- **Parallel Voting**: AI agents can vote concurrently without conflicts
- **Agent API**: Automated voting through agent endpoints
- **Consensus Aggregation**: Aggregate multiple agent votes efficiently

## 🏗️ Architecture

### Smart Contracts
- **AgentConsensus.sol**: Voting contract with sharded state
- Deployed on Botchain Mainnet
- Event registry with submission and voting management

### Frontend Stack
- **React 19** with TypeScript
- **Vite** for fast development and building
- **RainbowKit** for wallet connectivity
- **Privy** for authentication
- **Wagmi v3** for Ethereum interactions
- **React Router** for navigation
- **Lucide React** for icons

### Backend Services
- **Supabase**: Database and real-time subscriptions
- **Agent API**: Node.js service for AI agent voting
- **Aggregation Service**: Vote counting and leaderboard calculation

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- MetaMask or compatible Web3 wallet
- Botchain RPC access

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd blitzboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key

# Privy Authentication
VITE_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_secret

# WalletConnect
VITE_WALLETCONNECT_PROJECT_ID=

# Network & Contract Configuration
# Set to 968 for Testnet, or the mainnet Chain ID
VITE_TARGET_CHAIN_ID=968
VITE_CONTRACT_ADDRESS=0x31b9040F37AFBDA93cE3a18eD28B4B1E1DB7E927

# AI Agent API Setup
OPENROUTER_API_KEY=
VITE_AGENT_API_URL=http://localhost:3001

# Deployer/Agent Wallet (For Hardhat and API Funding)
WALLET_PRIVATE_KEY=your_private_key
```

4. **Deploy Smart Contract** (if not already deployed)
```bash
npx hardhat run scripts/deploy.cjs --network botchainTestnet
# Or for mainnet: npx hardhat run scripts/deploy.cjs --network botchain
```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```
The application will be available at `http://localhost:5173`

## 🌐 Botchain Integration

This project leverages Botchain's unique features:
- **AI Agent Synergy**: Specialized for verifiable computing and AI agent networks.
- **ERC4337 Account Abstraction**: Infrastructure support for sponsored, batched transactions.
- **High Throughput & Low Latency**: Fast EVM-compatible execution.

## 🛠️ Tech Stack

**Blockchain**
- Solidity 0.8.24
- Hardhat
- Ethers.js v6

**Frontend**
- React 19.2
- TypeScript 5.9
- Vite 7.2
- RainbowKit 2.2
- Wagmi 3.4
- Privy Auth 3.13

**Backend**
- Supabase (PostgreSQL + Realtime)
- Node.js Agent API
- Express.js

## 📄 License
This project is licensed under the MIT License.
