import { useNavigate } from 'react-router-dom';
import { Trophy, Users, ArrowRight, Zap } from 'lucide-react';
import { type LiveEventWithLeaderboard } from '../../lib/leaderboardService';
import './LiveEventCard.css';

interface LiveEventCardProps {
    data: LiveEventWithLeaderboard;
}

export function LiveEventCard({ data }: LiveEventCardProps) {
    const navigate = useNavigate();
    const { event, topSubmissions, totalSubmissions } = data;

    const getRankBadge = (rank: number) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return rank;
        }
    };

    return (
        <div className="live-event-card">
            <div className="live-event-header">
                {event.cover_image_url ? (
                    <img src={event.cover_image_url} alt={event.name} className="live-event-cover" />
                ) : (
                    <div className="live-event-cover-placeholder">
                        <Trophy size={32} />
                    </div>
                )}
                <div className="live-badge">
                    <Zap size={12} />
                    LIVE VOTING
                </div>
            </div>

            <div className="live-event-content">
                <h3>{event.name}</h3>

                <div className="submissions-count">
                    <Users size={14} />
                    {totalSubmissions} submissions
                </div>

                {topSubmissions.length > 0 ? (
                    <div className="mini-leaderboard">
                        {topSubmissions.map(entry => (
                            <div key={entry.submission_id} className="mini-leaderboard-row">
                                <span className="rank-badge">{getRankBadge(entry.rank)}</span>
                                <span className="project-name">{entry.project_title}</span>
                                <span className="project-score">{entry.score}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-submissions-yet">
                        No submissions yet
                    </div>
                )}

                <button
                    className="view-leaderboard-btn"
                    onClick={() => navigate(`/leaderboard/${event.id}`)}
                >
                    View Leaderboard
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}
