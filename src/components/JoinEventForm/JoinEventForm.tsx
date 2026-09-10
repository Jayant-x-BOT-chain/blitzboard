import { useState } from 'react';
import { Search, Loader2, AlertCircle, Calendar, Users } from 'lucide-react';
import { validateEventCode, type Submission } from '../../lib/submissionService';
import { type Event } from '../../lib/eventService';
import './JoinEventForm.css';

interface JoinEventFormProps {
    onEventFound: (event: Event) => void;
    existingSubmission?: Submission | null;
}

export function JoinEventForm({ onEventFound, existingSubmission }: JoinEventFormProps) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [foundEvent, setFoundEvent] = useState<Event | null>(null);

    const handleCodeChange = (value: string) => {
        // Uppercase and limit to 8 chars
        const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        setCode(formatted);
        setError(null);
        setFoundEvent(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (code.length !== 8) {
            setError('Please enter a valid 8-character code');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await validateEventCode(code);

            if (!result.valid || !result.event) {
                setError(result.error || 'Invalid event code');
                return;
            }

            setFoundEvent(result.event);
        } catch (err: any) {
            setError(err.message || 'Failed to validate code');
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = () => {
        if (foundEvent) {
            onEventFound(foundEvent);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="join-event-form">
            <form onSubmit={handleSubmit}>
                <div className="code-input-wrapper">
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => handleCodeChange(e.target.value)}
                        placeholder="ENTER CODE"
                        className="code-input"
                        maxLength={8}
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="search-btn"
                        disabled={loading || code.length !== 8}
                    >
                        {loading ? <Loader2 size={20} className="spinning" /> : <Search size={20} />}
                    </button>
                </div>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}
            </form>

            {foundEvent && (
                <div className="event-preview-card">
                    {foundEvent.cover_image_url && (
                        <img
                            src={foundEvent.cover_image_url}
                            alt={foundEvent.name}
                            className="event-cover"
                        />
                    )}
                    <div className="event-details">
                        <h3>{foundEvent.name}</h3>
                        {foundEvent.description && (
                            <p className="event-description">{foundEvent.description}</p>
                        )}
                        <div className="event-meta">
                            <span>
                                <Calendar size={14} />
                                {formatDate(foundEvent.start_date)} - {formatDate(foundEvent.end_date)}
                            </span>
                            <span>
                                <Users size={14} />
                                {foundEvent.submission_type}
                            </span>
                        </div>
                    </div>

                    {existingSubmission ? (
                        <div className="already-submitted">
                            You've already submitted to this event
                        </div>
                    ) : (
                        <button
                            className="btn btn-primary continue-btn"
                            onClick={handleContinue}
                        >
                            Continue to Submit
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
