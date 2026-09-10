import { useNavigate } from 'react-router-dom';
import { Calendar, ExternalLink, Trophy } from 'lucide-react';
import { type Submission } from '../../lib/submissionService';
import { type Event } from '../../lib/eventService';
import './SubmissionCard.css';

interface SubmissionCardProps {
    submission: Submission;
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
    const navigate = useNavigate();
    const event = submission.event as Event | undefined;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="submission-card">
            {event?.cover_image_url && (
                <img
                    src={event.cover_image_url}
                    alt={event.name}
                    className="submission-event-cover"
                />
            )}
            <div className="submission-card-content">
                <div className="submission-event-name">
                    {event?.name || 'Unknown Event'}
                </div>
                <h3 className="submission-title">{submission.project_title}</h3>
                {submission.description && (
                    <p className="submission-description">{submission.description}</p>
                )}
                <div className="submission-meta">
                    <span className="submitted-date">
                        <Calendar size={14} />
                        Submitted {formatDate(submission.submitted_at)}
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
                <button
                    className="btn btn-secondary btn-sm leaderboard-link"
                    onClick={() => navigate(`/leaderboard/${submission.event_id}`)}
                >
                    <Trophy size={14} />
                    View Leaderboard
                </button>
            </div>
        </div>
    );
}
