import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Loader2, Vote, CheckCircle, Clock, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { JoinEventForm } from '../components/JoinEventForm';
import { getVoterEvents, type VoterEventState } from '../lib/votingService';
import { type Event } from '../lib/eventService';
import './VoterDashboard.css';

type VoterEventWithEvent = VoterEventState & { event: Event };

export function VoterDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [voterEvents, setVoterEvents] = useState<VoterEventWithEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadVoterEvents() {
            if (!user) return;

            try {
                const data = await getVoterEvents(user.id);
                setVoterEvents(data);
            } catch (err) {
                console.error('Failed to load voter events:', err);
            } finally {
                setLoading(false);
            }
        }

        loadVoterEvents();
    }, [user]);

    const handleEventFound = async (event: Event) => {
        // Join event and navigate to voting
        if (!user) return;

        // Import dynamically to avoid circular deps
        const { joinEventAsVoter } = await import('../lib/votingService');
        const result = await joinEventAsVoter(event.event_code!, user.id);

        if (result.success) {
            navigate(`/vote/${event.id}`);
        }
    };

    const activeEvents = voterEvents.filter(v => !v.has_voted && v.event?.status === 'live');
    const completedEvents = voterEvents.filter(v => v.has_voted);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="voter-dashboard">
            <div className="container">
                {/* Profile Section */}
                <section className="profile-section">
                    <div className="profile-card">
                        <div className="profile-avatar">
                            <User size={32} />
                        </div>
                        <div className="profile-info">
                            <h2>{user?.email || 'Voter'}</h2>
                            <span className="role-badge voter">Voter</span>
                        </div>
                    </div>
                </section>

                {/* Join Event Section */}
                <section className="join-section">
                    <h2>Join an Event to Vote</h2>
                    <p>Enter the 8-character event code to start voting</p>
                    <JoinEventForm onEventFound={handleEventFound} />
                </section>

                {/* Active Voting Sessions */}
                <section className="events-section">
                    <h2>
                        <Clock size={24} />
                        Active Voting Sessions
                    </h2>

                    {loading ? (
                        <div className="loading-state">
                            <Loader2 size={24} className="spinning" />
                        </div>
                    ) : activeEvents.length === 0 ? (
                        <div className="empty-state">
                            <p>No active voting sessions. Join an event to vote!</p>
                        </div>
                    ) : (
                        <div className="events-grid">
                            {activeEvents.map(ve => (
                                <div key={ve.id} className="event-voting-card">
                                    {ve.event?.cover_image_url && (
                                        <img src={ve.event.cover_image_url} alt={ve.event.name} />
                                    )}
                                    <div className="event-voting-content">
                                        <h3>{ve.event?.name}</h3>
                                        <div className="credits-display">
                                            <span className="credits">{ve.total_credits - ve.credits_spent}</span>
                                            <span className="label">credits left</span>
                                        </div>
                                        <div className="event-actions">
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => navigate(`/vote/${ve.event_id}`)}
                                            >
                                                <Vote size={18} />
                                                Vote Now
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => navigate(`/leaderboard/${ve.event_id}`)}
                                            >
                                                <Trophy size={18} />
                                                Leaderboard
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Completed Voting */}
                <section className="events-section">
                    <h2>
                        <CheckCircle size={24} />
                        Completed Voting
                    </h2>

                    {completedEvents.length === 0 ? (
                        <div className="empty-state">
                            <p>You haven't voted in any events yet.</p>
                        </div>
                    ) : (
                        <div className="events-grid completed">
                            {completedEvents.map(ve => (
                                <div key={ve.id} className="event-voting-card completed">
                                    {ve.event?.cover_image_url && (
                                        <img src={ve.event.cover_image_url} alt={ve.event.name} />
                                    )}
                                    <div className="event-voting-content">
                                        <h3>{ve.event?.name}</h3>
                                        <div className="voted-badge">
                                            <CheckCircle size={16} />
                                            Voted
                                        </div>
                                        <p className="voted-date">
                                            {ve.voted_at && formatDate(ve.voted_at)}
                                        </p>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => navigate(`/leaderboard/${ve.event_id}`)}
                                        >
                                            <Trophy size={16} />
                                            View Leaderboard
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
