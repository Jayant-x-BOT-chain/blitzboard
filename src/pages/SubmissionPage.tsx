import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getEventById, type Event } from '../lib/eventService';
import { createSubmission, hasExistingSubmission } from '../lib/submissionService';
import './SubmissionPage.css';

type PageState = 'loading' | 'form' | 'submitting' | 'success' | 'error' | 'duplicate';

export function SubmissionPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [pageState, setPageState] = useState<PageState>('loading');
    const [event, setEvent] = useState<Event | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [projectLink, setProjectLink] = useState('');

    // Load event and check for existing submission
    useEffect(() => {
        async function loadEvent() {
            if (!eventId || !user) return;

            try {
                const data = await getEventById(eventId);
                if (!data) {
                    setError('Event not found');
                    setPageState('error');
                    return;
                }

                if (data.status !== 'live') {
                    setError('This event is not accepting submissions');
                    setPageState('error');
                    return;
                }

                setEvent(data);

                // Check for existing submission
                const exists = await hasExistingSubmission(eventId, user.id);
                if (exists) {
                    setPageState('duplicate');
                    return;
                }

                setPageState('form');
            } catch (err) {
                console.error('Failed to load event:', err);
                setError('Failed to load event');
                setPageState('error');
            }
        }

        loadEvent();
    }, [eventId, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user || !eventId) return;

        if (!title.trim()) {
            setError('Project title is required');
            return;
        }

        setPageState('submitting');
        setError(null);

        try {
            await createSubmission(user.id, {
                event_id: eventId,
                project_title: title.trim(),
                description: description.trim() || undefined,
                project_link: projectLink.trim() || undefined,
            });

            setPageState('success');
        } catch (err: any) {
            console.error('Submission failed:', err);
            setError(err.message || 'Failed to submit');
            setPageState('form');
        }
    };

    const renderContent = () => {
        switch (pageState) {
            case 'loading':
                return (
                    <div className="submission-loading">
                        <Loader2 size={40} className="spinning" />
                        <p>Loading event...</p>
                    </div>
                );

            case 'duplicate':
                return (
                    <div className="submission-duplicate">
                        <AlertCircle size={40} />
                        <h2>Already Submitted</h2>
                        <p>You've already submitted a project to this event.</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/dashboard/submitter')}
                        >
                            View My Submissions
                        </button>
                    </div>
                );

            case 'form':
                return (
                    <form className="submission-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="title">Project Title *</label>
                            <input
                                id="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter your project name"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Tell us about your project..."
                                rows={4}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="link">Project / Demo Link</label>
                            <input
                                id="link"
                                type="url"
                                value={projectLink}
                                onChange={(e) => setProjectLink(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>

                        {error && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => navigate(-1)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                Submit Project
                            </button>
                        </div>
                    </form>
                );

            case 'submitting':
                return (
                    <div className="submission-loading">
                        <Loader2 size={40} className="spinning" />
                        <p>Submitting your project...</p>
                    </div>
                );

            case 'success':
                return (
                    <div className="submission-success">
                        <div className="success-icon">
                            <Check size={40} />
                        </div>
                        <h2>Submitted! 🎉</h2>
                        <p>Your project has been submitted to {event?.name}</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/dashboard/submitter')}
                        >
                            View My Submissions
                        </button>
                    </div>
                );

            case 'error':
                return (
                    <div className="submission-error">
                        <AlertCircle size={40} />
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/dashboard/submitter')}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="submission-page">
            <div className="container">
                {pageState !== 'success' && (
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                        Back
                    </button>
                )}

                {event && pageState === 'form' && (
                    <div className="event-header">
                        {event.cover_image_url && (
                            <img src={event.cover_image_url} alt={event.name} className="event-cover" />
                        )}
                        <div className="event-info">
                            <h1>{event.name}</h1>
                            {event.description && <p>{event.description}</p>}
                        </div>
                    </div>
                )}

                <div className="submission-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
