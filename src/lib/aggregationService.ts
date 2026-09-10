import { AGENT_CONSENSUS_ADDRESS } from './contract';

// VoteCast event signature for filtering
const VOTE_CAST_EVENT = {
    type: 'event',
    name: 'VoteCast',
    inputs: [
        { indexed: true, name: 'voter', type: 'address' },
        { indexed: true, name: 'eventId', type: 'string' },
        { indexed: false, name: 'submissionId', type: 'string' },
        { indexed: false, name: 'votes', type: 'uint256' }
    ]
} as const;

export interface VoteCastLog {
    voter: string;
    eventId: string;
    submissionId: string;
    votes: number;
    blockNumber: bigint;
    transactionHash: string;
}

export interface SubmissionScoreAggregate {
    submissionId: string;
    totalVotes: number;
    voterCount: number;
    voters: string[];
}

/**
 * Aggregate scores for all submissions in an event using VoteCast events.
 * This is the off-chain aggregation approach for high throughput.
 */
export async function aggregateEventScores(
    eventId: string,
    publicClient: any
): Promise<Map<string, SubmissionScoreAggregate>> {
    try {
        // Get all VoteCast events for this event
        const logs = await publicClient.getLogs({
            address: AGENT_CONSENSUS_ADDRESS,
            event: VOTE_CAST_EVENT,
            fromBlock: 'earliest',
            toBlock: 'latest'
        });

        // Filter by eventId and aggregate
        const aggregates = new Map<string, SubmissionScoreAggregate>();

        for (const log of logs) {
            const args = log.args as {
                voter: string;
                eventId: string;
                submissionId: string;
                votes: bigint;
            };

            // Skip if different event
            if (args.eventId !== eventId) continue;

            const submissionId = args.submissionId;
            const votes = Number(args.votes);
            const voter = args.voter;

            if (!aggregates.has(submissionId)) {
                aggregates.set(submissionId, {
                    submissionId,
                    totalVotes: 0,
                    voterCount: 0,
                    voters: []
                });
            }

            const agg = aggregates.get(submissionId)!;
            agg.totalVotes += votes;
            agg.voterCount += 1;
            agg.voters.push(voter);
        }

        return aggregates;
    } catch (err) {
        console.error('Error aggregating scores:', err);
        return new Map();
    }
}

/**
 * Get aggregated score for a single submission
 */
export async function getAggregatedSubmissionScore(
    eventId: string,
    submissionId: string,
    publicClient: any
): Promise<number> {
    const aggregates = await aggregateEventScores(eventId, publicClient);
    return aggregates.get(submissionId)?.totalVotes || 0;
}

/**
 * Get leaderboard (sorted submissions by score)
 */
export async function getEventLeaderboard(
    eventId: string,
    publicClient: any
): Promise<SubmissionScoreAggregate[]> {
    const aggregates = await aggregateEventScores(eventId, publicClient);

    return Array.from(aggregates.values())
        .sort((a, b) => b.totalVotes - a.totalVotes);
}

/**
 * Calculate voting metrics for an event
 */
export interface VotingMetrics {
    totalVotes: number;
    uniqueVoters: number;
    uniqueSubmissions: number;
    votesPerSecond?: number;
    startBlock?: bigint;
    endBlock?: bigint;
}

export async function getEventVotingMetrics(
    eventId: string,
    publicClient: any
): Promise<VotingMetrics> {
    try {
        const logs = await publicClient.getLogs({
            address: AGENT_CONSENSUS_ADDRESS,
            event: VOTE_CAST_EVENT,
            fromBlock: 'earliest',
            toBlock: 'latest'
        });

        const voters = new Set<string>();
        const submissions = new Set<string>();
        let totalVotes = 0;
        let minBlock = BigInt(Number.MAX_SAFE_INTEGER);
        let maxBlock = BigInt(0);

        for (const log of logs) {
            const args = log.args as {
                voter: string;
                eventId: string;
                submissionId: string;
                votes: bigint;
            };

            if (args.eventId !== eventId) continue;

            voters.add(args.voter);
            submissions.add(args.submissionId);
            totalVotes += Number(args.votes);

            if (log.blockNumber < minBlock) minBlock = log.blockNumber;
            if (log.blockNumber > maxBlock) maxBlock = log.blockNumber;
        }

        return {
            totalVotes,
            uniqueVoters: voters.size,
            uniqueSubmissions: submissions.size,
            startBlock: voters.size > 0 ? minBlock : undefined,
            endBlock: voters.size > 0 ? maxBlock : undefined
        };
    } catch (err) {
        console.error('Error getting voting metrics:', err);
        return {
            totalVotes: 0,
            uniqueVoters: 0,
            uniqueSubmissions: 0
        };
    }
}
