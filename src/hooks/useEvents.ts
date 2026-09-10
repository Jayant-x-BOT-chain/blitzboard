import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import {
    getHostEvents,
    createEvent,
    updateEvent,
    markEventEnded,
    type Event,
    type CreateEventInput,
    type UpdateEventInput,
} from '../lib/eventService';

export function useEvents() {
    const { user } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await getHostEvents(user.id);
            setEvents(data);
        } catch (err) {
            console.error('Failed to fetch events:', err);
            setError('Failed to load events');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const addEvent = async (input: CreateEventInput): Promise<Event | null> => {
        if (!user?.id) return null;

        try {
            const newEvent = await createEvent(user.id, input);
            setEvents(prev => [newEvent, ...prev]);
            return newEvent;
        } catch (err) {
            console.error('Failed to create event:', err);
            setError('Failed to create event');
            return null;
        }
    };

    const editEvent = async (eventId: string, input: UpdateEventInput): Promise<Event | null> => {
        try {
            const updated = await updateEvent(eventId, input);
            setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
            return updated;
        } catch (err) {
            console.error('Failed to update event:', err);
            setError('Failed to update event');
            return null;
        }
    };

    const closeEvent = async (eventId: string): Promise<boolean> => {
        try {
            await markEventEnded(eventId);
            setEvents(prev => prev.map(e =>
                e.id === eventId ? { ...e, status: 'ended' as const } : e
            ));
            return true;
        } catch (err) {
            console.error('Failed to close event:', err);
            setError('Failed to close event');
            return false;
        }
    };

    return {
        events,
        loading,
        error,
        fetchEvents,
        addEvent,
        editEvent,
        closeEvent,
    };
}
