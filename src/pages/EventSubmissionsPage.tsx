import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Inbox, ExternalLink, Calendar, Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getEventById, type Event } from '../lib/eventService';
import { getEventSubmissions, type Submission } from '../lib/submissionService';
import './EventSubmissionsPage.css';

export function EventSubmissionsPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [event, setEvent] = useState<Event | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            if (!eventId || !user) return;

            try {
                const eventData = await getEventById(eventId);
                if (!eventData) {
                    setError('Event not found');
                    setLoading(false);
                    return;
                }

                // Verify ownership
                if (eventData.host_id !== user.id) {
                    setError('You do not have access to this event');
                    setLoading(false);
                    return;
                }

                setEvent(eventData);

                const subs = await getEventSubmissions(eventId);
                setSubmissions(subs);
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load submissions');
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [eventId, user]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="event-submissions-page">
                <div className="container">
                    <div className="loading-state">
                        <Loader2 size={40} className="spinning" />
                        <p>Loading submissions...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="event-submissions-page">
                <div className="container">
                    <div className="error-state">
                        <p>{error}</p>
                        <button className="btn btn-primary" onClick={() => navigate('/dashboard/host')}>
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="event-submissions-page">
            <div className="container">
                <button className="back-btn" onClick={() => navigate('/dashboard/host')}>
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </button>

                <div className="page-header">
                    <div className="event-info">
                        {event?.cover_image_url && (
                            <img src={event.cover_image_url} alt={event.name} className="event-thumb" />
                        )}
                        <div>
                            <h1>{event?.name}</h1>
                            <p className="event-code">Event Code: <strong>{event?.event_code}</strong></p>
                        </div>
                    </div>
                    <div className="submissions-count">
                        <span className="count">{submissions.length}</span>
                        <span className="label">Submissions</span>
                    </div>
                </div>

                {/* Leaderboard Link */}
                {(event?.status === 'live' || event?.status === 'ended') && (
                    <button
                        className="btn btn-outline"
                        onClick={() => navigate(`/leaderboard/${eventId}`)}
                        style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Trophy size={18} />
                        View Leaderboard
                    </button>
                )}

                {submissions.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} />
                        <h3>No submissions yet</h3>
                        <p>Share your event code with participants to start receiving submissions.</p>
                    </div>
                ) : (
                    <div className="submissions-list">
                        {submissions.map((submission, index) => (
                            <div key={submission.id} className="submission-item">
                                <div className="submission-number">#{index + 1}</div>
                                <div className="submission-content">
                                    <h3>{submission.project_title}</h3>
                                    {submission.description && (
                                        <p className="submission-description">{submission.description}</p>
                                    )}
                                    <div className="submission-meta">
                                        <span>
                                            <Calendar size={14} />
                                            {formatDate(submission.submitted_at)}
                                        </span>
                                        {submission.project_link && (
                                            <a
                                                href={submission.project_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="project-link"
                                            >
                                                <ExternalLink size={14} />
                                                View Project
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
