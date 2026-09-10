import { supabase } from './supabase';
import { type Event } from './eventService';

// =====================================================
// TYPES
// =====================================================

export interface LeaderboardEntry {
    rank: number;
    submission_id: string;
    project_title: string;
    description: string | null;
    project_link: string | null;
    score: number;
    submitted_at: string;
}

export interface LiveEventWithLeaderboard {
    event: Event;
    topSubmissions: LeaderboardEntry[];
    totalSubmissions: number;
}

// =====================================================
// LIVE EVENTS
// =====================================================

/**
 * Get all live events with their top 3 submissions
 */
export async function getLiveEventsWithLeaderboard(): Promise<LiveEventWithLeaderboard[]> {
    // Get live events
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'live')
        .order('start_date', { ascending: false });

    if (eventError || !events) {
        console.error('Error fetching live events:', eventError);
        return [];
    }

    // For each event, get top 3 submissions
    const results: LiveEventWithLeaderboard[] = [];

    for (const event of events) {
        const { data: submissions, count } = await supabase
            .from('submissions')
            .select('id, project_title, description, project_link, score, submitted_at', { count: 'exact' })
            .eq('event_id', event.id)
            .order('score', { ascending: false })
            .order('submitted_at', { ascending: true })
            .limit(3);

        const topSubmissions: LeaderboardEntry[] = (submissions || []).map((s, idx) => ({
            rank: idx + 1,
            submission_id: s.id,
            project_title: s.project_title,
            description: s.description,
            project_link: s.project_link,
            score: s.score || 0,
            submitted_at: s.submitted_at,
        }));

        results.push({
            event,
            topSubmissions,
            totalSubmissions: count || 0,
        });
    }

    return results;
}

// =====================================================
// EVENT LEADERBOARD
// =====================================================

/**
 * Get full leaderboard for an event
 */
export async function getEventLeaderboard(eventId: string): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
        .from('submissions')
        .select('id, project_title, description, project_link, score, submitted_at')
        .eq('event_id', eventId)
        .order('score', { ascending: false })
        .order('submitted_at', { ascending: true });

    if (error) {
        console.error('Error fetching leaderboard:', error);
        return [];
    }

    return (data || []).map((s, idx) => ({
        rank: idx + 1,
        submission_id: s.id,
        project_title: s.project_title,
        description: s.description,
        project_link: s.project_link,
        score: s.score || 0,
        submitted_at: s.submitted_at,
    }));
}

/**
 * Get event status for display
 */
export function getEventVotingStatus(event: Event): 'upcoming' | 'live_voting' | 'voting_closed' {
    if (event.status === 'live') {
        return 'live_voting';
    }
    if (event.status === 'ended' || event.status === 'cancelled') {
        return 'voting_closed';
    }
    return 'upcoming';
}

/**
 * Subscribe to leaderboard changes (Supabase Realtime)
 */
export function subscribeToLeaderboard(
    eventId: string,
    onUpdate: () => void
): () => void {
    const channel = supabase
        .channel(`leaderboard-${eventId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'submissions',
                filter: `event_id=eq.${eventId}`,
            },
            () => {
                onUpdate();
            }
        )
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}
