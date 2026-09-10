import { supabase } from './supabase';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { botchain } from './wagmi';
import { AGENT_CONSENSUS_ADDRESS } from './contract';

// =====================================================
// TYPES
// =====================================================

export interface AgentWallet {
    id: string;
    wallet_address: string;
    agent_index: number;
    created_at: string;
}

export interface AgentVote {
    id: string;
    event_id: string;
    submission_id: string;
    agent_address: string;
    vote_count: number;
    vote_cost: number;
    tx_hash: string | null;
    block_number: number | null;
    synced_at: string;
}

export interface AgentScoreEntry {
    submission_id: string;
    agent_score: number;
    agent_voter_count: number;
}

export interface HybridLeaderboardEntry {
    rank: number;
    submission_id: string;
    project_title: string;
    description: string | null;
    project_link: string | null;
    submitted_at: string;
    human_score: number;
    agent_score: number;
    combined_score: number;
    human_voter_count: number;
    agent_voter_count: number;
}

// =====================================================
// PUBLIC CLIENT FOR ON-CHAIN READS
// =====================================================

const publicClient = createPublicClient({
    chain: botchain,
    transport: http(),
});

// =====================================================
// AGENT WALLET MANAGEMENT
// =====================================================

/**
 * Get all registered agent wallet addresses
 */
export async function getAgentWallets(): Promise<AgentWallet[]> {
    const { data, error } = await supabase
        .from('agent_wallets')
        .select('*')
        .order('agent_index', { ascending: true });

    if (error) {
        console.error('Error fetching agent wallets:', error);
        return [];
    }

    return data || [];
}

/**
 * Get agent wallet addresses as a Set for quick lookup
 */
export async function getAgentAddressSet(): Promise<Set<string>> {
    const wallets = await getAgentWallets();
    return new Set(wallets.map(w => w.wallet_address.toLowerCase()));
}

/**
 * Register agent wallets in Supabase (bulk insert)
 */
export async function registerAgentWallets(
    wallets: { address: string; index: number }[]
): Promise<boolean> {
    const records = wallets.map(w => ({
        wallet_address: w.address.toLowerCase(),
        agent_index: w.index,
    }));

    const { error } = await supabase
        .from('agent_wallets')
        .upsert(records, { onConflict: 'wallet_address' });

    if (error) {
        console.error('Error registering agent wallets:', error);
        return false;
    }

    return true;
}

// =====================================================
// ON-CHAIN VOTE SYNC
// =====================================================

/**
 * Sync agent votes from on-chain VoteCast events into Supabase.
 * This reads all VoteCast events for the event, filters for agent addresses,
 * and upserts them into the agent_votes table.
 */
export async function syncAgentVotesFromChain(eventId: string): Promise<{
    synced: number;
    error?: string;
}> {
    try {
        // Get known agent addresses
        const agentAddresses = await getAgentAddressSet();
        if (agentAddresses.size === 0) {
            return { synced: 0, error: 'No agent wallets registered' };
        }

        // Read VoteCast events from chain
        const logs = await publicClient.getLogs({
            address: AGENT_CONSENSUS_ADDRESS,
            event: parseAbiItem(
                'event VoteCast(address indexed voter, string indexed eventId, string submissionId, uint256 votes)'
            ),
            fromBlock: 'earliest',
            toBlock: 'latest',
        });

        // Filter for this event's agent votes
        const agentVoteRecords: {
            event_id: string;
            submission_id: string;
            agent_address: string;
            vote_count: number;
            vote_cost: number;
            tx_hash: string;
            block_number: number;
        }[] = [];

        for (const log of logs) {
            const args = log.args as {
                voter: string;
                eventId: string;
                submissionId: string;
                votes: bigint;
            };

            // Skip if not this event or not an agent
            if (!args.voter || !args.submissionId) continue;
            if (args.eventId !== eventId) continue;
            if (!agentAddresses.has(args.voter.toLowerCase())) continue;

            const voteCount = Number(args.votes);
            agentVoteRecords.push({
                event_id: eventId,
                submission_id: args.submissionId,
                agent_address: args.voter.toLowerCase(),
                vote_count: voteCount,
                vote_cost: voteCount * voteCount,
                tx_hash: log.transactionHash,
                block_number: Number(log.blockNumber),
            });
        }

        if (agentVoteRecords.length === 0) {
            return { synced: 0 };
        }

        // Upsert into Supabase
        const { error } = await supabase
            .from('agent_votes')
            .upsert(agentVoteRecords, {
                onConflict: 'event_id,submission_id,agent_address',
            });

        if (error) {
            console.error('Error syncing agent votes:', error);
            return { synced: 0, error: error.message };
        }

        return { synced: agentVoteRecords.length };
    } catch (err: any) {
        console.error('Error syncing agent votes from chain:', err);
        return { synced: 0, error: err.message };
    }
}

// =====================================================
// AGENT SCORES QUERIES
// =====================================================

/**
 * Get agent-only scores for an event (from Supabase agent_votes table)
 */
export async function getAgentScores(eventId: string): Promise<Map<string, AgentScoreEntry>> {
    const { data, error } = await supabase
        .from('agent_votes')
        .select('submission_id, vote_count, agent_address')
        .eq('event_id', eventId);

    if (error) {
        console.error('Error fetching agent scores:', error);
        return new Map();
    }

    // Aggregate by submission
    const map = new Map<string, AgentScoreEntry>();
    for (const row of data || []) {
        const existing = map.get(row.submission_id);
        if (existing) {
            existing.agent_score += row.vote_count;
            existing.agent_voter_count += 1;
        } else {
            map.set(row.submission_id, {
                submission_id: row.submission_id,
                agent_score: row.vote_count,
                agent_voter_count: 1,
            });
        }
    }

    return map;
}

/**
 * Get agent voter count for an event
 */
export async function getAgentVoterCount(eventId: string): Promise<number> {
    const { data, error } = await supabase
        .from('agent_votes')
        .select('agent_address')
        .eq('event_id', eventId);

    if (error) return 0;

    const unique = new Set((data || []).map(d => d.agent_address));
    return unique.size;
}

// =====================================================
// HYBRID LEADERBOARD (Human + Agent + Combined)
// =====================================================

/**
 * Build the full hybrid leaderboard with human, agent, and combined scores.
 * Human scores come from submissions.score (written by votingService)
 * Agent scores come from agent_votes table (synced from on-chain)
 */
export async function getHybridLeaderboard(eventId: string): Promise<HybridLeaderboardEntry[]> {
    // 1. Get submissions with human scores
    const { data: submissions, error: subError } = await supabase
        .from('submissions')
        .select('id, project_title, description, project_link, score, submitted_at')
        .eq('event_id', eventId)
        .order('submitted_at', { ascending: true });

    if (subError || !submissions) {
        console.error('Error fetching submissions for hybrid leaderboard:', subError);
        return [];
    }

    // 2. Get agent scores
    const agentScores = await getAgentScores(eventId);

    // 3. Get human voter counts from votes table
    const { data: humanVotesData } = await supabase
        .from('votes')
        .select('submission_id, voter_id')
        .eq('event_id', eventId);

    const humanVoterCounts = new Map<string, number>();
    for (const v of humanVotesData || []) {
        humanVoterCounts.set(
            v.submission_id,
            (humanVoterCounts.get(v.submission_id) || 0) + 1
        );
    }

    // 4. Merge into hybrid entries
    const entries: HybridLeaderboardEntry[] = submissions.map(s => {
        const agentData = agentScores.get(s.id);
        const humanScore = s.score || 0;
        const agentScore = agentData?.agent_score || 0;

        return {
            rank: 0, // Will be set per-tab
            submission_id: s.id,
            project_title: s.project_title,
            description: s.description,
            project_link: s.project_link,
            submitted_at: s.submitted_at,
            human_score: humanScore,
            agent_score: agentScore,
            combined_score: humanScore + agentScore,
            human_voter_count: humanVoterCounts.get(s.id) || 0,
            agent_voter_count: agentData?.agent_voter_count || 0,
        };
    });

    return entries;
}

/**
 * Sort and rank entries by a specific score type
 */
export function rankByScoreType(
    entries: HybridLeaderboardEntry[],
    scoreType: 'human' | 'agent' | 'combined'
): HybridLeaderboardEntry[] {
    const scoreKey = scoreType === 'human'
        ? 'human_score'
        : scoreType === 'agent'
            ? 'agent_score'
            : 'combined_score';

    const sorted = [...entries].sort((a, b) => {
        const diff = b[scoreKey] - a[scoreKey];
        if (diff !== 0) return diff;
        // Tiebreak by submission time
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
    });

    return sorted.map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
    }));
}

// =====================================================
// ON-CHAIN METRICS
// =====================================================

/**
 * Get agent voting metrics from on-chain data
 */
export async function getAgentVotingMetrics(eventId: string): Promise<{
    totalAgentVotes: number;
    uniqueAgents: number;
    avgVotesPerAgent: number;
}> {
    const agentScores = await getAgentScores(eventId);
    const agentCount = await getAgentVoterCount(eventId);

    let totalVotes = 0;
    for (const entry of agentScores.values()) {
        totalVotes += entry.agent_score;
    }

    return {
        totalAgentVotes: totalVotes,
        uniqueAgents: agentCount,
        avgVotesPerAgent: agentCount > 0 ? Math.round(totalVotes / agentCount) : 0,
    };
}

// =====================================================
// TRIGGER AGENT VOTING (calls agent-api.cjs server)
// =====================================================

export interface AgentVotingResult {
    success: boolean;
    eventId: string;
    submissionCount: number;
    agentCount: number;
    successCount: number;
    skipCount: number;
    failCount: number;
    aiScores: {
        submissionId: string;
        title: string;
        total: number;
        reasoning: string;
    }[];
    error?: string;
}

const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:3001';

/**
 * Check if the agent API server is running
 */
export async function checkAgentApiHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${AGENT_API_URL}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data.status === 'ok';
    } catch {
        return false;
    }
}

/**
 * Trigger AI agent voting for an event.
 * Calls the agent-api.cjs server which:
 * 1. Fetches submissions from Supabase
 * 2. Evaluates each with OpenRouter AI
 * 3. Funds agent wallets if needed
 * 4. Votes on-chain in parallel
 * 5. Records results in Supabase
 */
export async function triggerAgentVoting(eventId: string, agentCount: number = 5): Promise<AgentVotingResult> {
    // Check if agent API is reachable first
    const isHealthy = await checkAgentApiHealth();
    if (!isHealthy) {
        throw new Error(
            'Agent API server is not running. Start it with: node scripts/agent-api.cjs'
        );
    }

    const res = await fetch(`${AGENT_API_URL}/api/agent-vote/${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentCount }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || `Agent API returned ${res.status}`);
    }

    return data as AgentVotingResult;
}
