import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Loader2, Inbox } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { JoinEventForm } from '../components/JoinEventForm';
import { SubmissionCard } from '../components/SubmissionCard';
import { getUserSubmissions, type Submission } from '../lib/submissionService';
import { type Event } from '../lib/eventService';
import './SubmitterDashboard.css';

export function SubmitterDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadSubmissions() {
            if (!user) return;

            try {
                const data = await getUserSubmissions(user.id);
                setSubmissions(data);
            } catch (err) {
                console.error('Failed to load submissions:', err);
            } finally {
                setLoading(false);
            }
        }

        loadSubmissions();
    }, [user]);

    const handleEventFound = (event: Event) => {
        navigate(`/submit/${event.id}`);
    };

    return (
        <div className="submitter-dashboard">
            <div className="container">
                {/* Profile Section */}
                <section className="profile-section">
                    <div className="profile-card">
                        <div className="profile-avatar">
                            <User size={32} />
                        </div>
                        <div className="profile-info">
                            <h2>{user?.email || 'Submitter'}</h2>
                            <span className="role-badge">Submitter</span>
                        </div>
                    </div>
                </section>

                {/* Join Event Section */}
                <section className="join-section">
                    <h2>Join an Event</h2>
                    <p>Enter the 8-character event code to submit your project</p>
                    <JoinEventForm
                        onEventFound={handleEventFound}
                    />
                </section>

                {/* My Submissions Section */}
                <section className="submissions-section">
                    <h2>My Submissions</h2>

                    {loading ? (
                        <div className="loading-state">
                            <Loader2 size={24} className="spinning" />
                            <p>Loading submissions...</p>
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="empty-state">
                            <Inbox size={48} />
                            <h3>No submissions yet</h3>
                            <p>Join an event using a code to submit your first project!</p>
                        </div>
                    ) : (
                        <div className="submissions-grid">
                            {submissions.map(submission => (
                                <SubmissionCard
                                    key={submission.id}
                                    submission={submission}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
