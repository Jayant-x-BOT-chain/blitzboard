import { supabase } from './supabase';
import { getEventByCode, type Event } from './eventService';
import { EVENT_FACTORY_ADDRESS, EVENT_FACTORY_ABI } from './contract';
import { createPublicClient, http } from 'viem';
import { botchainTestnet as botchain } from './wagmi';

// =====================================================
// TYPES
// =====================================================

export interface Submission {
    id: string;
    event_id: string;
    submitter_id: string;
    project_title: string;
    description: string | null;
    project_link: string | null;
    submitted_at: string;
    updated_at: string;
    // Joined fields
    event?: Event;
}

export interface CreateSubmissionInput {
    event_id: string;
    project_title: string;
    description?: string;
    project_link?: string;
}

// =====================================================
// PUBLIC CLIENT FOR READ-ONLY CONTRACT CALLS
// =====================================================

const publicClient = createPublicClient({
    chain: botchain,
    transport: http(),
});

// =====================================================
// EVENT VALIDATION
// =====================================================

/**
 * Validate event code and check if event is active
 * Returns event details if valid, null otherwise
 */
export async function validateEventCode(eventCode: string): Promise<{
    valid: boolean;
    event: Event | null;
    error?: string;
}> {
    // Normalize code
    const code = eventCode.trim().toUpperCase();

    if (code.length !== 8) {
        return { valid: false, event: null, error: 'Event code must be 8 characters' };
    }

    // Check Supabase for event
    const event = await getEventByCode(code);

    if (!event) {
        return { valid: false, event: null, error: 'Event not found' };
    }

    if (event.status !== 'live') {
        return { valid: false, event: null, error: 'Event is not accepting submissions' };
    }

    // Optionally verify on-chain (only if contract address exists)
    if (event.contract_address) {
        try {
            const isActive = await publicClient.readContract({
                address: EVENT_FACTORY_ADDRESS,
                abi: EVENT_FACTORY_ABI,
                functionName: 'isEventActive',
                args: [event.id],
            });

            if (!isActive) {
                return { valid: false, event: null, error: 'Event is closed on blockchain' };
            }
        } catch (err) {
            console.warn('Contract validation failed, using DB status:', err);
            // Continue with DB status as fallback
        }
    }

    return { valid: true, event };
}

// =====================================================
// SUBMISSION CRUD
// =====================================================

/**
 * Check if user has already submitted to an event
 */
export async function hasExistingSubmission(eventId: string, submitterId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('submissions')
        .select('id')
        .eq('event_id', eventId)
        .eq('submitter_id', submitterId)
        .maybeSingle();

    if (error) {
        console.error('Error checking submission:', error);
        return false;
    }

    return !!data;
}

/**
 * Create a new submission
 */
export async function createSubmission(
    submitterId: string,
    input: CreateSubmissionInput
): Promise<Submission> {
    // Check for duplicate
    const exists = await hasExistingSubmission(input.event_id, submitterId);
    if (exists) {
        throw new Error('You have already submitted to this event');
    }

    const { data, error } = await supabase
        .from('submissions')
        .insert({
            event_id: input.event_id,
            submitter_id: submitterId,
            project_title: input.project_title,
            description: input.description || null,
            project_link: input.project_link || null,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating submission:', error);
        throw error;
    }

    return data;
}

/**
 * Get all submissions for a user with event details
 */
export async function getUserSubmissions(submitterId: string): Promise<Submission[]> {
    const { data, error } = await supabase
        .from('submissions')
        .select(`
            *,
            event:events(*)
        `)
        .eq('submitter_id', submitterId)
        .order('submitted_at', { ascending: false });

    if (error) {
        console.error('Error fetching submissions:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single submission by ID
 */
export async function getSubmissionById(submissionId: string): Promise<Submission | null> {
    const { data, error } = await supabase
        .from('submissions')
        .select(`
            *,
            event:events(*)
        `)
        .eq('id', submissionId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching submission:', error);
        throw error;
    }

    return data;
}

/**
 * Get all submissions for an event
 */
export async function getEventSubmissions(eventId: string): Promise<Submission[]> {
    const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('event_id', eventId)
        .order('submitted_at', { ascending: true });

    if (error) {
        console.error('Error fetching event submissions:', error);
        throw error;
    }

    return data || [];
}

/**
 * Update a submission
 */
export async function updateSubmission(
    submissionId: string,
    input: Partial<CreateSubmissionInput>
): Promise<Submission> {
    const { data, error } = await supabase
        .from('submissions')
        .update({
            project_title: input.project_title,
            description: input.description,
            project_link: input.project_link,
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) {
        console.error('Error updating submission:', error);
        throw error;
    }

    return data;
}
