import { useState, useEffect } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { LiveEventCard } from '../LiveEventCard';
import { getLiveEventsWithLeaderboard, type LiveEventWithLeaderboard } from '../../lib/leaderboardService';
import './LiveEventsSection.css';

export function LiveEventsSection() {
    const [liveEvents, setLiveEvents] = useState<LiveEventWithLeaderboard[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLiveEvents() {
            try {
                const data = await getLiveEventsWithLeaderboard();
                setLiveEvents(data);
            } catch (err) {
                console.error('Error loading live events:', err);
            } finally {
                setLoading(false);
            }
        }

        loadLiveEvents();

        // Refresh every 30s
        const interval = setInterval(loadLiveEvents, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <section className="live-events-section">
                <div className="container">
                    <div className="section-header">
                        <Zap size={24} className="zap-icon" />
                        <h2>Live Events</h2>
                    </div>
                    <div className="loading-state">
                        <Loader2 size={24} className="spinning" />
                    </div>
                </div>
            </section>
        );
    }

    if (liveEvents.length === 0) {
        return null; // Don't show section if no live events
    }

    return (
        <section className="live-events-section">
            <div className="container">
                <div className="section-header">
                    <Zap size={24} className="zap-icon" />
                    <h2>Live Events</h2>
                    <span className="live-count">{liveEvents.length} active</span>
                </div>

                <div className="live-events-grid">
                    {liveEvents.map(data => (
                        <LiveEventCard key={data.event.id} data={data} />
                    ))}
                </div>
            </div>
        </section>
    );
}
