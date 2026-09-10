import { supabase } from './supabase';
import { validateEventCode } from './submissionService';
import { type Event } from './eventService';

// =====================================================
// CONSTANTS
// =====================================================

export const DEFAULT_CREDITS = 100;

// =====================================================
// TYPES
// =====================================================

export interface VoterEventState {
    id: string;
    voter_id: string;
    event_id: string;
    total_credits: number;
    credits_spent: number;
    has_voted: boolean;
    joined_at: string;
    voted_at: string | null;
}

export interface Vote {
    id: string;
    voter_id: string;
    event_id: string;
    submission_id: string;
    vote_count: number;
    vote_cost: number;
    created_at: string;
}

export interface VoteAllocation {
    submission_id: string;
    vote_count: number;
}

export interface SubmissionWithVotes {
    id: string;
    project_title: string;
    description: string | null;
    project_link: string | null;
    submitter_id: string;
    score: number;
    // For voting UI
    allocated_votes?: number;
}

// =====================================================
// QUADRATIC VOTING MATH
// =====================================================

/**
 * Calculate the cost for a given number of votes
 * Cost = votes²
 */
export function calculateVoteCost(voteCount: number): number {
    return voteCount * voteCount;
}

/**
 * Calculate total cost for multiple allocations
 */
export function calculateTotalCost(allocations: VoteAllocation[]): number {
    return allocations.reduce((sum, a) => sum + calculateVoteCost(a.vote_count), 0);
}

/**
 * Get max votes possible with remaining credits
 */
export function getMaxVotes(remainingCredits: number): number {
    return Math.floor(Math.sqrt(remainingCredits));
}

// =====================================================
// VOTER EVENT STATE
// =====================================================

/**
 * Join an event as a voter
 */
export async function joinEventAsVoter(
    eventCode: string,
    voterId: string
): Promise<{ success: boolean; state?: VoterEventState; event?: Event; error?: string }> {
    // Validate event code
    const validation = await validateEventCode(eventCode);
    if (!validation.valid || !validation.event) {
        return { success: false, error: validation.error };
    }

    const event = validation.event;

    // Check if already joined
    const existingState = await getVoterEventState(event.id, voterId);
    if (existingState) {
        return { success: true, state: existingState, event };
    }

    // Create new voter state
    const { data, error } = await supabase
        .from('voter_event_state')
        .insert({
            voter_id: voterId,
            event_id: event.id,
            total_credits: DEFAULT_CREDITS,
            credits_spent: 0,
            has_voted: false,
        })
        .select()
        .single();

    if (error) {
        console.error('Error joining event:', error);
        return { success: false, error: 'Failed to join event' };
    }

    return { success: true, state: data, event };
}

/**
 * Get voter's state for an event
 */
export async function getVoterEventState(
    eventId: string,
    voterId: string
): Promise<VoterEventState | null> {
    const { data, error } = await supabase
        .from('voter_event_state')
        .select('*')
        .eq('event_id', eventId)
        .eq('voter_id', voterId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching voter state:', error);
        return null;
    }

    return data;
}

/**
 * Get all events a voter has joined
 */
export async function getVoterEvents(voterId: string): Promise<(VoterEventState & { event: Event })[]> {
    const { data, error } = await supabase
        .from('voter_event_state')
        .select(`
            *,
            event:events(*)
        `)
        .eq('voter_id', voterId)
        .order('joined_at', { ascending: false });

    if (error) {
        console.error('Error fetching voter events:', error);
        return [];
    }

    return data || [];
}

// =====================================================
// SUBMISSIONS FOR VOTING
// =====================================================

/**
 * Get submissions for voting (excludes voter's own submissions)
 */
export async function getEventSubmissionsForVoting(
    eventId: string,
    voterId: string
): Promise<SubmissionWithVotes[]> {
    const { data, error } = await supabase
        .from('submissions')
        .select('id, project_title, description, project_link, submitter_id, score')
        .eq('event_id', eventId)
        .neq('submitter_id', voterId) // Exclude own submissions
        .order('submitted_at', { ascending: true });

    if (error) {
        console.error('Error fetching submissions:', error);
        return [];
    }

    return (data || []).map(s => ({ ...s, allocated_votes: 0 }));
}

// =====================================================
// VOTING
// =====================================================

/**
 * Submit votes for an event (batch commit)
 * This is the main voting function with all validations
 */
export async function submitVotes(
    eventId: string,
    voterId: string,
    allocations: VoteAllocation[]
): Promise<{ success: boolean; error?: string }> {
    // 1. Get voter state
    const state = await getVoterEventState(eventId, voterId);
    if (!state) {
        return { success: false, error: 'You have not joined this event' };
    }

    // 2. Check if already voted
    if (state.has_voted) {
        return { success: false, error: 'You have already voted in this event' };
    }

    // 3. Filter out zero votes
    const validAllocations = allocations.filter(a => a.vote_count > 0);
    if (validAllocations.length === 0) {
        return { success: false, error: 'No votes allocated' };
    }

    // 4. Calculate total cost
    const totalCost = calculateTotalCost(validAllocations);
    const availableCredits = state.total_credits - state.credits_spent;

    if (totalCost > availableCredits) {
        return { success: false, error: `Not enough credits. Need ${totalCost}, have ${availableCredits}` };
    }

    // 5. Verify all submissions exist and belong to this event
    const submissionIds = validAllocations.map(a => a.submission_id);
    const { data: submissions, error: subError } = await supabase
        .from('submissions')
        .select('id, submitter_id, event_id')
        .in('id', submissionIds)
        .eq('event_id', eventId);

    if (subError || !submissions || submissions.length !== submissionIds.length) {
        return { success: false, error: 'Invalid submission(s)' };
    }

    // 6. Check voter is not voting for own submission
    const ownSubmission = submissions.find(s => s.submitter_id === voterId);
    if (ownSubmission) {
        return { success: false, error: 'Cannot vote for your own submission' };
    }

    // 7. Create vote records
    const voteRecords = validAllocations.map(a => ({
        voter_id: voterId,
        event_id: eventId,
        submission_id: a.submission_id,
        vote_count: a.vote_count,
        vote_cost: calculateVoteCost(a.vote_count),
    }));

    const { error: voteError } = await supabase
        .from('votes')
        .insert(voteRecords);

    if (voteError) {
        console.error('Error inserting votes:', voteError);
        return { success: false, error: 'Failed to save votes' };
    }

    // 8. Update submission scores (simple update, no RPC needed)
    for (const allocation of validAllocations) {
        const { data: currentSub } = await supabase
            .from('submissions')
            .select('score')
            .eq('id', allocation.submission_id)
            .single();

        if (currentSub) {
            await supabase
                .from('submissions')
                .update({ score: (currentSub.score || 0) + allocation.vote_count })
                .eq('id', allocation.submission_id);
        }
    }

    // 9. Update voter state
    const { error: stateError } = await supabase
        .from('voter_event_state')
        .update({
            credits_spent: state.credits_spent + totalCost,
            has_voted: true,
            voted_at: new Date().toISOString(),
        })
        .eq('id', state.id);

    if (stateError) {
        console.error('Error updating voter state:', stateError);
        // Votes are already saved, but state update failed
        // This is a partial failure state
    }

    return { success: true };
}

export async function getVoterVotes(eventId: string, voterId: string): Promise<Vote[]> {
    const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('event_id', eventId)
        .eq('voter_id', voterId);

    if (error) {
        console.error('Error fetching votes:', error);
        return [];
    }

    return data || [];
}

// =====================================================
// FULL ON-CHAIN VOTING
// =====================================================

/**
 * Submit votes directly to blockchain (fully on-chain storage)
 * This stores actual vote data on-chain, not just a hash
 */
export async function submitVotesOnChain(
    eventId: string,
    allocations: VoteAllocation[],
    walletClient: any, // wagmi wallet client
    publicClient: any  // wagmi public client
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        // Import contract details
        const { EVENT_FACTORY_ADDRESS, EVENT_FACTORY_ABI } = await import('./contract');

        // Filter and prepare vote data
        const validAllocations = allocations.filter(a => a.vote_count > 0);

        if (validAllocations.length === 0) {
            return { success: false, error: 'No votes allocated' };
        }

        const submissionIds = validAllocations.map(a => a.submission_id);
        const voteCounts = validAllocations.map(a => BigInt(a.vote_count));

        // Calculate total cost for validation
        const totalCost = validAllocations.reduce((sum, a) => sum + (a.vote_count * a.vote_count), 0);
        if (totalCost > DEFAULT_CREDITS) {
            return { success: false, error: `Exceeds credit limit (${totalCost} > ${DEFAULT_CREDITS})` };
        }

        // Call submitVotes on the contract
        const hash = await walletClient.writeContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: EVENT_FACTORY_ABI,
            functionName: 'submitVotes',
            args: [eventId, submissionIds, voteCounts],
        });

        // Wait for transaction
        await publicClient.waitForTransactionReceipt({ hash });

        return { success: true, txHash: hash };
    } catch (err: any) {
        console.error('Error submitting votes on-chain:', err);
        return { success: false, error: err.message || 'Failed to submit votes on-chain' };
    }
}

/**
 * Check if a voter has already voted on-chain
 */
export async function hasVoterVotedOnChain(
    eventId: string,
    voterAddress: string,
    publicClient: any
): Promise<boolean> {
    try {
        const { EVENT_FACTORY_ADDRESS, EVENT_FACTORY_ABI } = await import('./contract');

        const hasVoted = await publicClient.readContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: EVENT_FACTORY_ABI,
            functionName: 'hasVoterVoted',
            args: [voterAddress, eventId],
        });

        return hasVoted as boolean;
    } catch (err) {
        console.error('Error checking on-chain vote status:', err);
        return false;
    }
}

/**
 * Get a submission's score from on-chain
 */
export async function getSubmissionScoreOnChain(
    eventId: string,
    submissionId: string,
    publicClient: any
): Promise<number> {
    try {
        const { EVENT_FACTORY_ADDRESS, EVENT_FACTORY_ABI } = await import('./contract');

        const score = await publicClient.readContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: EVENT_FACTORY_ABI,
            functionName: 'getSubmissionScore',
            args: [eventId, submissionId],
        });

        return Number(score);
    } catch (err) {
        console.error('Error getting on-chain score:', err);
        return 0;
    }
}

/**
 * Get voter's votes from on-chain
 */
export async function getVoterVotesOnChain(
    eventId: string,
    voterAddress: string,
    publicClient: any
): Promise<{ submissionIds: string[]; voteCounts: number[]; voteCosts: number[] }> {
    try {
        const { EVENT_FACTORY_ADDRESS, EVENT_FACTORY_ABI } = await import('./contract');

        const result = await publicClient.readContract({
            address: EVENT_FACTORY_ADDRESS,
            abi: EVENT_FACTORY_ABI,
            functionName: 'getVoterVotes',
            args: [voterAddress, eventId],
        }) as [string[], bigint[], bigint[]];

        return {
            submissionIds: result[0],
            voteCounts: result[1].map(Number),
            voteCosts: result[2].map(Number),
        };
    } catch (err) {
        console.error('Error getting on-chain votes:', err);
        return { submissionIds: [], voteCounts: [], voteCosts: [] };
    }
}

