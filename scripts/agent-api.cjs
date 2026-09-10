#!/usr/bin/env node

// =====================================================
// AI Agent Voting API Server
// Evaluates submissions using OpenRouter (free LLMs)
// then votes on-chain via agent wallets
// =====================================================
// Run with: node scripts/agent-api.cjs
// Endpoint:  POST /api/agent-vote/:eventId
// Health:    GET  /api/health

require("dotenv").config();
const http = require("http");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// =====================================================
// CONFIG
// =====================================================
const PORT = process.env.PORT || process.env.AGENT_API_PORT || 3001;
const HOST = '0.0.0.0'; // Bind to all interfaces (required for Render/cloud)
const RPC_URL = "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDRESS = "0xc410352706ac0Ae9eB670afda875E602c83bFce0";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const CREDITS_PER_VOTER = 100;
const MIN_BALANCE_WEI = ethers.parseEther("0.05");
const FUND_AMOUNT_WEI = ethers.parseEther("0.1");

// Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Contract ABI (minimal)
const ABI = [
    "function submitVotes(string eventId, string[] submissionIds, uint256[] voteCounts) external",
    "function hasVoterVoted(address voter, string eventId) external view returns (bool)",
];

// Track running jobs to prevent double-triggers
const runningJobs = new Set();

// =====================================================
// OPENROUTER AI EVALUATION (FREE)
// =====================================================

/**
 * Evaluate a single submission using OpenRouter (free LLMs)
 */
async function evaluateWithAI(submission) {
    if (!OPENROUTER_API_KEY) {
        console.log("⚠️  No OPENROUTER_API_KEY, using heuristic fallback");
        return heuristicEvaluate(submission);
    }

    const prompt = `You are an expert hackathon judge evaluating project submissions.
Score this submission objectively. Be STRICT about quality.

SUBMISSION:
- Title: ${submission.title}
- Description: ${submission.description || "No description provided"}
- Project Link: ${submission.projectLink || "No link provided"}

SCORING CRITERIA (0-10 each):
1. technical_merit: Code quality signals, technical complexity, architecture
2. clarity: Clear explanation of what the project does and how
3. innovation: Originality and creative problem-solving
4. completeness: Evidence of a working product (links, demos, details)

PENALTY CRITERIA (0 to -5 each, use negative numbers):
5. buzzword_penalty: Penalize excessive buzzwords without substance (e.g. "revolutionary AI blockchain synergy"). 0 = no buzzwords, -5 = all buzzwords no substance
6. manipulation_penalty: Penalize attempts to manipulate judges (e.g. "please vote for us", "we deserve to win", emotional appeals). 0 = no manipulation, -5 = blatant manipulation

Return ONLY valid JSON with this exact structure, no other text:
{
  "technical_merit": <number 0-10>,
  "clarity": <number 0-10>,
  "innovation": <number 0-10>,
  "completeness": <number 0-10>,
  "buzzword_penalty": <number -5 to 0>,
  "manipulation_penalty": <number -5 to 0>,
  "reasoning": "<brief 1-2 sentence justification>"
}`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://blitzboard.app",
                "X-Title": "BlitzBoard AI Agents",
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`OpenRouter API error (${response.status}):`, errText.slice(0, 200));
            return heuristicEvaluate(submission);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            console.error("OpenRouter returned empty response");
            return heuristicEvaluate(submission);
        }

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("Could not parse JSON from response:", text.slice(0, 100));
            return heuristicEvaluate(submission);
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and clamp values
        const result = {
            technical_merit: clamp(parsed.technical_merit || 0, 0, 10),
            clarity: clamp(parsed.clarity || 0, 0, 10),
            innovation: clamp(parsed.innovation || 0, 0, 10),
            completeness: clamp(parsed.completeness || 0, 0, 10),
            buzzword_penalty: clamp(parsed.buzzword_penalty || 0, -5, 0),
            manipulation_penalty: clamp(parsed.manipulation_penalty || 0, -5, 0),
            reasoning: parsed.reasoning || "AI evaluation complete",
        };

        result.total = Math.max(0,
            result.technical_merit +
            result.clarity +
            result.innovation +
            result.completeness +
            result.buzzword_penalty +
            result.manipulation_penalty
        );

        return result;
    } catch (err) {
        console.error("OpenRouter evaluation failed:", err.message);
        return heuristicEvaluate(submission);
    }
}

/**
 * Heuristic fallback scoring (no API needed)
 */
function heuristicEvaluate(submission) {
    const desc = submission.description || "";
    const title = submission.title || "";
    const link = submission.projectLink || "";

    let technical_merit = 3;
    let clarity = 3;
    let innovation = 3;
    let completeness = 2;
    let buzzword_penalty = 0;
    let manipulation_penalty = 0;

    // Technical merit signals
    if (desc.length > 200) technical_merit += 2;
    if (desc.length > 500) technical_merit += 1;
    if (desc.match(/api|sdk|protocol|algorithm|database|contract/i)) technical_merit += 1;

    // Clarity
    if (desc.length > 100) clarity += 2;
    if (title.length > 8) clarity += 1;

    // Innovation
    if (desc.match(/novel|unique|first|new approach/i)) innovation += 1;

    // Completeness
    if (link) completeness += 3;
    if (link.includes("github.com")) completeness += 1;
    if (desc.match(/demo|live|deployed/i)) completeness += 1;

    // Buzzword penalty
    const buzzwords = (desc.match(/revolutionary|disruptive|synergy|paradigm|web3|blockchain|ai|metaverse/gi) || []).length;
    if (buzzwords > 3) buzzword_penalty = -Math.min(5, buzzwords - 2);

    // Manipulation penalty
    if (desc.match(/please vote|vote for us|we deserve|help us win|best project/i)) {
        manipulation_penalty = -3;
    }

    const total = Math.max(0,
        clamp(technical_merit, 0, 10) +
        clamp(clarity, 0, 10) +
        clamp(innovation, 0, 10) +
        clamp(completeness, 0, 10) +
        buzzword_penalty +
        manipulation_penalty
    );

    return {
        technical_merit: clamp(technical_merit, 0, 10),
        clarity: clamp(clarity, 0, 10),
        innovation: clamp(innovation, 0, 10),
        completeness: clamp(completeness, 0, 10),
        buzzword_penalty,
        manipulation_penalty,
        reasoning: "Heuristic evaluation (no Gemini API key)",
        total,
    };
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// =====================================================
// VOTE DISTRIBUTION
// =====================================================

/**
 * Convert AI scores to quadratic vote allocations.
 * Each agent gets a slightly different perspective via jitter.
 */
function scoreToVotes(submissions, aiScores, agentIndex) {
    const allocations = [];
    let remainingCredits = CREDITS_PER_VOTER;

    // Create scored list with per-agent jitter
    const scored = submissions.map((s, i) => {
        const baseScore = aiScores[i]?.total || 0;
        // Per-agent jitter: each agent has a slightly different perspective
        const jitter = ((agentIndex * 7 + s.title.length + i * 3) % 5) - 2; // -2 to +2
        return {
            submissionId: s.id,
            score: Math.max(0, baseScore + jitter),
        };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    for (const item of scored) {
        if (remainingCredits <= 0) break;

        // Map score (0-40) to votes (1-7)
        const maxFromScore = Math.max(1, Math.min(7, Math.ceil(item.score / 5)));
        const maxFromBudget = Math.floor(Math.sqrt(remainingCredits));
        const votes = Math.min(maxFromScore, maxFromBudget);
        const cost = votes * votes;

        if (cost <= remainingCredits && votes > 0) {
            allocations.push({
                submissionId: item.submissionId,
                voteCount: votes,
            });
            remainingCredits -= cost;
        }
    }

    return allocations;
}

// =====================================================
// WALLET MANAGEMENT
// =====================================================

function loadAgentWallets(count = 5) {
    const walletsPath = path.join(__dirname, "agent-wallets.json");
    let allWallets = [];

    if (fs.existsSync(walletsPath)) {
        allWallets = JSON.parse(fs.readFileSync(walletsPath, "utf-8"));
    }

    // Generate more wallets on-the-fly if we need more than we have
    if (allWallets.length < count) {
        console.log(`   Generating ${count - allWallets.length} additional wallets...`);
        for (let i = allWallets.length; i < count; i++) {
            const wallet = ethers.Wallet.createRandom();
            allWallets.push({
                index: i + 1,
                address: wallet.address,
                privateKey: wallet.privateKey,
            });
        }
        // Save the expanded wallet pool
        fs.writeFileSync(walletsPath, JSON.stringify(allWallets, null, 2));
    }

    // Return only the requested number
    return allWallets.slice(0, count);
}

async function ensureWalletsFunded(wallets, provider) {
    const deployerKey = process.env.WALLET_PRIVATE_KEY;
    if (!deployerKey) {
        console.log("⚠️  No WALLET_PRIVATE_KEY set, skipping wallet funding");
        return;
    }

    const deployer = new ethers.Wallet(deployerKey, provider);
    const deployerBalance = await provider.getBalance(deployer.address);
    console.log(`💰 Deployer balance: ${ethers.formatEther(deployerBalance)} MON`);

    for (const w of wallets) {
        const balance = await provider.getBalance(w.address);
        if (balance < MIN_BALANCE_WEI) {
            console.log(`💸 Funding agent ${w.index}: ${w.address.slice(0, 10)}...`);
            try {
                const tx = await deployer.sendTransaction({
                    to: w.address,
                    value: FUND_AMOUNT_WEI,
                    gasLimit: 21000,
                });
                await tx.wait();
                console.log(`   ✅ Funded with 0.1 MON`);
            } catch (err) {
                console.error(`   ❌ Funding failed: ${err.message?.slice(0, 80)}`);
            }
        }
    }
}

async function ensureWalletsRegistered(wallets) {
    if (!supabase) return;
    const records = wallets.map(w => ({
        wallet_address: w.address.toLowerCase(),
        agent_index: w.index,
    }));
    const { error } = await supabase
        .from("agent_wallets")
        .upsert(records, { onConflict: "wallet_address" });
    if (error) console.error("⚠️  Error registering wallets:", error.message);
}

// =====================================================
// SUPABASE HELPERS
// =====================================================

async function fetchSubmissions(eventId) {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase
        .from("submissions")
        .select("id, project_title, description, project_link")
        .eq("event_id", eventId);

    if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
    if (!data || data.length === 0) throw new Error("No submissions found for this event");

    return data.map(s => ({
        id: s.id,
        title: s.project_title,
        description: s.description || "",
        projectLink: s.project_link || null,
    }));
}

async function recordAgentVotes(eventId, agentAddress, allocations, txHash, blockNumber) {
    if (!supabase) return;

    const records = allocations.map(a => ({
        event_id: eventId,
        submission_id: a.submissionId,
        agent_address: agentAddress.toLowerCase(),
        vote_count: a.voteCount,
        vote_cost: a.voteCount * a.voteCount,
        tx_hash: txHash || null,
        block_number: blockNumber || null,
    }));

    const { error } = await supabase
        .from("agent_votes")
        .upsert(records, { onConflict: "event_id,submission_id,agent_address" });

    if (error) {
        console.error(`⚠️  Error recording votes for ${agentAddress}:`, error.message);
    }
}

// =====================================================
// MAIN VOTING PIPELINE
// =====================================================

async function runAgentVotingPipeline(eventId, agentCount = 5) {
    agentCount = Math.max(1, Math.min(50, agentCount)); // clamp 1-50
    console.log(`\n🤖 Starting AI Agent Voting Pipeline for event: ${eventId}`);
    console.log(`   Agent count: ${agentCount}`);
    console.log("=".repeat(60));

    // 1. Fetch submissions
    console.log("\n📦 Step 1: Fetching submissions...");
    const submissions = await fetchSubmissions(eventId);
    console.log(`   Found ${submissions.length} submissions`);

    // 2. AI Evaluation with OpenRouter
    console.log("\n🧠 Step 2: AI Evaluation with OpenRouter...");
    const aiScores = [];
    for (let i = 0; i < submissions.length; i++) {
        const s = submissions[i];
        console.log(`   Evaluating [${i + 1}/${submissions.length}]: ${s.title}`);
        const score = await evaluateWithAI(s);
        aiScores.push(score);
        console.log(`   → Score: ${score.total}/40 | ${score.reasoning?.slice(0, 60)}`);
        // Small delay to avoid rate limits
        if (OPENROUTER_API_KEY && i < submissions.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // 3. Load & prepare wallets (pre-funded, no delay)
    console.log(`\n👛 Step 3: Loading ${agentCount} pre-funded agent wallets...`);
    const wallets = loadAgentWallets(agentCount);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    await ensureWalletsRegistered(wallets);
    // Skip funding — wallets are pre-funded with 0.5 MON via fund-all-wallets.cjs

    // 4. Parallel on-chain voting
    console.log("\n⛓️  Step 4: On-chain voting (parallel)...");
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const results = [];

    const votePromises = wallets.map(async (walletData, index) => {
        try {
            const wallet = new ethers.Wallet(walletData.privateKey, provider);
            const connectedContract = contract.connect(wallet);

            // Check if already voted
            const hasVoted = await connectedContract.hasVoterVoted(wallet.address, eventId);
            if (hasVoted) {
                console.log(`   ⏭️  Agent ${index + 1}: Already voted`);
                skipCount++;
                return { success: false, reason: "already_voted", agentIndex: index };
            }

            // Distribute votes with per-agent jitter
            const allocations = scoreToVotes(submissions, aiScores, index);
            if (allocations.length === 0) {
                console.log(`   ⚠️  Agent ${index + 1}: No allocations`);
                return { success: false, reason: "no_allocations", agentIndex: index };
            }

            // Get gas price
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits("102", "gwei");

            // Submit votes on-chain
            const tx = await connectedContract.submitVotes(
                eventId,
                allocations.map(a => a.submissionId),
                allocations.map(a => a.voteCount),
                { gasLimit: 500000, gasPrice }
            );

            console.log(`   ✅ Agent ${index + 1}: TX ${tx.hash.slice(0, 16)}...`);
            const receipt = await tx.wait();
            successCount++;

            // Record in Supabase
            await recordAgentVotes(
                eventId,
                wallet.address,
                allocations,
                tx.hash,
                receipt?.blockNumber || null
            );

            return {
                success: true,
                agentIndex: index,
                txHash: tx.hash,
                allocations,
            };
        } catch (err) {
            failCount++;
            console.log(`   ❌ Agent ${index + 1}: ${err.message?.slice(0, 80)}`);
            return { success: false, agentIndex: index, error: err.message };
        }
    });

    const voteResults = await Promise.all(votePromises);

    // 5. Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 AGENT VOTING COMPLETE");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⏭️  Skipped:    ${skipCount}`);
    console.log(`❌ Failed:     ${failCount}`);
    console.log("=".repeat(60));

    return {
        success: true,
        eventId,
        submissionCount: submissions.length,
        agentCount: wallets.length,
        successCount,
        skipCount,
        failCount,
        aiScores: aiScores.map((s, i) => ({
            submissionId: submissions[i].id,
            title: submissions[i].title,
            total: s.total,
            reasoning: s.reasoning,
        })),
        votes: voteResults.filter(r => r.success),
    };
}

// =====================================================
// HTTP SERVER
// =====================================================

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/api/health") {
        sendJSON(res, 200, {
            status: "ok",
            openrouter: !!OPENROUTER_API_KEY,
            model: OPENROUTER_MODEL,
            supabase: !!supabase,
            timestamp: new Date().toISOString(),
        });
        return;
    }

    // Agent voting trigger
    const voteMatch = req.url?.match(/^\/api\/agent-vote\/(.+)$/);
    if (req.method === "POST" && voteMatch) {
        const eventId = decodeURIComponent(voteMatch[1]);

        // Prevent duplicate runs
        if (runningJobs.has(eventId)) {
            sendJSON(res, 409, {
                success: false,
                error: "Agent voting is already running for this event",
            });
            return;
        }

        runningJobs.add(eventId);

        // Parse request body for agentCount
        let agentCount = 5;
        try {
            const bodyChunks = [];
            for await (const chunk of req) bodyChunks.push(chunk);
            const body = Buffer.concat(bodyChunks).toString();
            if (body) {
                const parsed = JSON.parse(body);
                if (parsed.agentCount) agentCount = Number(parsed.agentCount);
            }
        } catch (_) { /* use default */ }

        console.log(`\n🚀 Received agent vote request for event: ${eventId} (${agentCount} agents)`);

        try {
            const result = await runAgentVotingPipeline(eventId, agentCount);
            sendJSON(res, 200, result);
        } catch (err) {
            console.error("❌ Pipeline error:", err.message);
            sendJSON(res, 500, {
                success: false,
                error: err.message,
            });
        } finally {
            runningJobs.delete(eventId);
        }
        return;
    }

    // 404
    sendJSON(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
    console.log(`\n🤖 Agent Voting API Server`);
    console.log(`   Port:       ${PORT}`);
    console.log(`   OpenRouter: ${OPENROUTER_API_KEY ? "✅ " + OPENROUTER_MODEL : "❌ Not set (using heuristics)"}`);
    console.log(`   Supabase:   ${supabase ? "✅ Connected" : "❌ Not configured"}`);
    console.log(`   Contract:   ${CONTRACT_ADDRESS}`);
    console.log(`\n   POST /api/agent-vote/:eventId  → Trigger AI agent voting`);
    console.log(`   GET  /api/health               → Health check\n`);
});
