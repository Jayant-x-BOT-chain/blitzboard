import { useNavigate } from 'react-router-dom';
import { Calendar, Eye, Edit2, XCircle, Clock, Users, FileText, Bot, Trophy } from 'lucide-react';
import { type Event, getDisplayStatus } from '../../lib/eventService';
import './EventCard.css';

interface EventCardProps {
    event: Event;
    onView?: (event: Event) => void;
    onEdit?: (event: Event) => void;
    onClose?: (event: Event) => void;
    onRunAgents?: (event: Event) => void;
    agentRunning?: boolean;
}

export function EventCard({ event, onView, onEdit, onClose, onRunAgents, agentRunning }: EventCardProps) {
    const navigate = useNavigate();
    const displayStatus = getDisplayStatus(event.status);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getStatusBadge = () => {
        switch (displayStatus) {
            case 'live':
                return <span className="status-badge status-live">Live</span>;
            case 'ended':
                return <span className="status-badge status-ended">Ended</span>;
            case 'cancelled':
                return <span className="status-badge status-cancelled">Cancelled</span>;
            default:
                return <span className="status-badge status-draft">Draft</span>;
        }
    };

    const handleView = () => {
        if (onView) {
            onView(event);
        } else if (displayStatus === 'draft') {
            // For drafts, navigate to the "submit to blockchain" page
            navigate(`/event/${event.id}/submit`);
        } else {
            // For live/ended events, navigate to the leaderboard
            navigate(`/leaderboard/${event.id}`);
        }
    };

    const handleEdit = () => {
        if (onEdit) {
            onEdit(event);
        } else {
            // Navigate to the submit-to-blockchain page for drafts
            navigate(`/event/${event.id}/submit`);
        }
    };

    const handleViewSubmissions = () => {
        navigate(`/event/${event.id}/submissions`);
    };

    return (
        <div className="event-card">
            <div className="event-card-image">
                {event.cover_image_url ? (
                    <img src={event.cover_image_url} alt={event.name} />
                ) : (
                    <div className="event-card-placeholder">
                        <Calendar size={32} />
                    </div>
                )}
                {getStatusBadge()}
            </div>

            <div className="event-card-content">
                <h3 className="event-card-title">{event.name}</h3>

                <div className="event-card-meta">
                    <div className="meta-item">
                        <Clock size={14} />
                        <span>{formatDate(event.start_date)} - {formatDate(event.end_date)}</span>
                    </div>
                    {event.event_type && (
                        <div className="meta-item">
                            <Users size={14} />
                            <span>{event.event_type}</span>
                        </div>
                    )}
                </div>

                {event.event_code && (
                    <div className="event-card-code">
                        Code: <strong>{event.event_code}</strong>
                    </div>
                )}
            </div>

            <div className="event-card-actions">
                {(displayStatus === 'live' || displayStatus === 'ended') && (
                    <button
                        className="action-btn action-primary"
                        onClick={handleViewSubmissions}
                        title="View Submissions"
                    >
                        <FileText size={18} />
                    </button>
                )}
                {(displayStatus === 'live' || displayStatus === 'ended') && (
                    <button
                        className="action-btn action-leaderboard"
                        onClick={() => navigate(`/leaderboard/${event.id}`)}
                        title="View Leaderboard"
                    >
                        <Trophy size={18} />
                    </button>
                )}
                <button className="action-btn" onClick={handleView} title="View">
                    <Eye size={18} />
                </button>
                {(displayStatus === 'draft') && (
                    <button className="action-btn" onClick={handleEdit} title="Edit">
                        <Edit2 size={18} />
                    </button>
                )}
                {(displayStatus === 'live') && onRunAgents && (
                    <button
                        className={`action-btn action-agent ${agentRunning ? 'agent-running' : ''}`}
                        onClick={() => onRunAgents(event)}
                        title={agentRunning ? 'AI Agents Running...' : 'Run AI Agents'}
                        disabled={agentRunning}
                    >
                        <Bot size={18} className={agentRunning ? 'spin' : ''} />
                    </button>
                )}
                {(displayStatus === 'live') && onClose && (
                    <button
                        className="action-btn action-danger"
                        onClick={() => onClose(event)}
                        title="Close Event"
                    >
                        <XCircle size={18} />
                    </button>
                )}
            </div>
        </div>
    );
}
