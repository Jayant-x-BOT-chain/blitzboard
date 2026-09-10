# Remove existing .git repository if it exists
if (Test-Path -Path ".git") {
    Remove-Item -Recurse -Force ".git"
}

# Initialize new git repository
git init

# Configure basic git settings (in case they are missing on the machine)
git config user.name "Jayant"
git config user.email "jayant@example.com"

# Commit 1: Initialize repository and dependencies
git add package.json package-lock.json
git commit -m "chore: initial setup and dependencies"

# Commit 2: Add build tools and typescript config
git add tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js
git commit -m "build: add typescript and vite config"

# Commit 3: Add index.html and public assets
git add index.html public/
git commit -m "docs: add public assets and index.html"

# Commit 4: Add global styles
git add src/index.css src/styles/
git commit -m "style: add global styling and css"

# Commit 5: Add Hardhat configuration
git add hardhat.config.cjs
git commit -m "chore: add hardhat configuration for Botchain"

# Commit 6: Add Smart Contracts
git add contracts/
git commit -m "feat(contracts): add AgentConsensus smart contract"

# Commit 7: Add deployment and test scripts
git add scripts/ test/
git commit -m "chore(scripts): add deploy and agent scripts"

# Commit 8: Setup lib folder and core services
git add src/lib/supabase.ts src/lib/agentVotingService.ts src/lib/submissionService.ts src/lib/contract.ts
git commit -m "feat(lib): add core services (supabase, agents, contracts)"

# Commit 9: Setup Wagmi and Botchain network configurations
git add src/lib/wagmi.ts
git commit -m "feat(web3): configure wagmi and botchain networks"

# Commit 10: Setup Custom Hooks
git add src/hooks/
git commit -m "feat(hooks): add useWallet and custom hooks"

# Commit 11: Build UI Components (Part 1)
git add src/components/EventForm/ src/components/Hero/ src/components/FeaturesGrid/
git commit -m "feat(components): build event form and landing components"

# Commit 12: Build UI Components (Part 2)
git add src/components/WalletConnect/ src/components/WhyBotchain/
git commit -m "feat(components): build wallet connect and why botchain components"

# Commit 13: Build Page Views
git add src/pages/
git commit -m "feat(pages): build routing and page views (voting, submit)"

# Commit 14: Final Application Wiring
git add src/App.tsx src/main.tsx src/vite-env.d.ts
git commit -m "feat: wire up main application entry"

# Commit 15: Add README and env examples
git add README.md .env.example vercel.json start-server.cjs Procfile .gitignore
git commit -m "docs: add README and project configuration"

# Add origin and push
git branch -M main
git remote add origin https://github.com/Jayant-x-BOT-chain/blitzboard.git
git push -u origin main --force
