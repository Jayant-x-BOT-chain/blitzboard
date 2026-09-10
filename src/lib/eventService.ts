import { supabase } from './supabase';

// =====================================================
// TYPES
// =====================================================

export type EventStatus = 'draft' | 'pending_submission' | 'live' | 'ended' | 'cancelled';
export type EventType = 'hackathon' | 'competition' | 'showcase' | 'other';
export type SubmissionType = 'individual' | 'team' | 'both';
export type Visibility = 'public' | 'private' | 'invite-only';

export interface Event {
    id: string;
    host_id: string;
    name: string;
    description: string | null;
    event_type: EventType | null;
    start_date: string;
    end_date: string;
    submission_type: SubmissionType;
    visibility: Visibility;
    cover_image_url: string | null;
    event_code: string | null;
    qr_code_url: string | null;
    contract_address: string | null;
    transaction_hash: string | null;
    status: EventStatus;
    created_at: string;
    updated_at: string;
}

export interface CreateEventInput {
    name: string;
    description?: string;
    event_type?: EventType;
    start_date: string;
    end_date: string;
    submission_type?: SubmissionType;
    visibility?: Visibility;
    cover_image_url?: string;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
    status?: EventStatus;
    event_code?: string;
    qr_code_url?: string;
    contract_address?: string;
    transaction_hash?: string;
}

// =====================================================
// EVENT CRUD OPERATIONS
// =====================================================

/**
 * Get all events for a host
 */
export async function getHostEvents(hostId: string): Promise<Event[]> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', hostId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching events:', error);
        throw error;
    }

    return data || [];
}

/**
 * Get a single event by ID
 */
export async function getEventById(eventId: string): Promise<Event | null> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching event:', error);
        throw error;
    }

    return data;
}

/**
 * Get event by event code
 */
export async function getEventByCode(eventCode: string): Promise<Event | null> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_code', eventCode)
        .maybeSingle();

    if (error) {
        console.error('Error fetching event by code:', error);
        throw error;
    }

    return data;
}

/**
 * Create a new event (draft)
 */
export async function createEvent(hostId: string, input: CreateEventInput): Promise<Event> {
    const { data, error } = await supabase
        .from('events')
        .insert({
            host_id: hostId,
            name: input.name,
            description: input.description || null,
            event_type: input.event_type || null,
            start_date: input.start_date,
            end_date: input.end_date,
            submission_type: input.submission_type || 'individual',
            visibility: input.visibility || 'public',
            cover_image_url: input.cover_image_url || null,
            status: 'draft',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating event:', error);
        throw error;
    }

    return data;
}

/**
 * Update an event
 */
export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<Event> {
    const { data, error } = await supabase
        .from('events')
        .update(input)
        .eq('id', eventId)
        .select()
        .single();

    if (error) {
        console.error('Error updating event:', error);
        throw error;
    }

    return data;
}

/**
 * Delete an event (only drafts can be deleted)
 */
export async function deleteEvent(eventId: string): Promise<void> {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('status', 'draft'); // Safety: only delete drafts

    if (error) {
        console.error('Error deleting event:', error);
        throw error;
    }
}

// =====================================================
// EVENT CODE GENERATION
// =====================================================

/**
 * Generate a unique 8-character event code
 */
export function generateEventCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// =====================================================
// STATUS TRANSITIONS
// =====================================================

/**
 * Mark event as pending submission (internal, for retry logic)
 */
export async function markEventPendingSubmission(eventId: string): Promise<Event> {
    return updateEvent(eventId, { status: 'pending_submission' });
}

/**
 * Mark event as live (after successful blockchain tx)
 */
export async function markEventLive(
    eventId: string,
    eventCode: string,
    contractAddress: string,
    transactionHash: string
): Promise<Event> {
    return updateEvent(eventId, {
        status: 'live',
        event_code: eventCode,
        contract_address: contractAddress,
        transaction_hash: transactionHash,
    });
}

/**
 * Mark event as ended
 */
export async function markEventEnded(eventId: string): Promise<Event> {
    return updateEvent(eventId, { status: 'ended' });
}

/**
 * Mark event as cancelled
 */
export async function markEventCancelled(eventId: string): Promise<Event> {
    return updateEvent(eventId, { status: 'cancelled' });
}

/**
 * Rollback from pending_submission to draft (on tx failure)
 */
export async function rollbackToDraft(eventId: string): Promise<Event> {
    return updateEvent(eventId, {
        status: 'draft',
        contract_address: undefined,
        transaction_hash: undefined,
    });
}

// =====================================================
// IMAGE UPLOAD
// =====================================================

/**
 * Upload cover image to Supabase Storage
 */
export async function uploadCoverImage(file: File, hostId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${hostId}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
        .from('event-covers')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) {
        console.error('Error uploading image:', error);
        throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from('event-covers')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

// =====================================================
// HELPER: Get user-facing status
// =====================================================

/**
 * Get display status (hides internal pending_submission)
 */
export function getDisplayStatus(status: EventStatus): string {
    if (status === 'pending_submission') {
        return 'draft'; // Hide internal status from UI
    }
    return status;
}
