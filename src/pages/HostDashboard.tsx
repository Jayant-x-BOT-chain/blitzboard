import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, AlertCircle, Bot, CheckCircle2 } from 'lucide-react';
import { ProfileCard } from '../components/ProfileCard';
import { EventCard } from '../components/EventCard';
import { useEvents } from '../hooks/useEvents';
import { type Event } from '../lib/eventService';
import { triggerAgentVoting, type AgentVotingResult } from '../lib/agentVotingService';
import './HostDashboard.css';

export function HostDashboard() {
    const navigate = useNavigate();
    const { events, loading, error, closeEvent } = useEvents();
    const [agentRunning, setAgentRunning] = useState<Record<string, boolean>>({});
    const [agentResults, setAgentResults] = useState<Record<string, AgentVotingResult>>({});
    const [agentError, setAgentError] = useState<Record<string, string>>({});
    const [agentCount, setAgentCount] = useState<Record<string, number>>({});
    const [showAgentPicker, setShowAgentPicker] = useState<Record<string, boolean>>({});

    const handleCloseEvent = async (event: Event) => {
        const confirmed = window.confirm(`Are you sure you want to close "${event.name}"?`);
        if (confirmed) {
            await closeEvent(event.id);
        }
    };

    const handleRunAgents = (event: Event) => {
        if (agentRunning[event.id]) return;
        // Toggle the agent count picker
        setShowAgentPicker(prev => ({ ...prev, [event.id]: !prev[event.id] }));
        // Set default count if not already set
        if (!agentCount[event.id]) {
            setAgentCount(prev => ({ ...prev, [event.id]: 5 }));
        }
    };

    const handleConfirmAgents = async (event: Event) => {
        const count = agentCount[event.id] || 5;
        setShowAgentPicker(prev => ({ ...prev, [event.id]: false }));
        setAgentRunning(prev => ({ ...prev, [event.id]: true }));
        setAgentError(prev => ({ ...prev, [event.id]: '' }));
        setAgentResults(prev => { const n = { ...prev }; delete n[event.id]; return n; });

        try {
            const result = await triggerAgentVoting(event.id, count);
            setAgentResults(prev => ({ ...prev, [event.id]: result }));
        } catch (err: any) {
            setAgentError(prev => ({
                ...prev,
                [event.id]: err.message || 'Agent voting failed',
            }));
        } finally {
            setAgentRunning(prev => ({ ...prev, [event.id]: false }));
        }
    };

    const draftEvents = events.filter(e => e.status === 'draft' || e.status === 'pending_submission');
    const liveEvents = events.filter(e => e.status === 'live');
    const pastEvents = events.filter(e => e.status === 'ended' || e.status === 'cancelled');

    return (
        <div className="host-dashboard">
            <div className="container">
                <h1 className="dashboard-title">Host Dashboard</h1>

                <ProfileCard />

                {/* Create Event Button */}
                <button
                    className="create-event-btn"
                    onClick={() => navigate('/create-event')}
                >
                    <Plus size={24} />
                    Create New Event
                </button>

                {/* Error State */}
                {error && (
                    <div className="error-message">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="loading-state">
                        <p>Loading your events...</p>
                    </div>
                ) : events.length === 0 ? (
                    /* Empty State */
                    <div className="empty-state">
                        <Calendar size={48} />
                        <h3>No Events Yet</h3>
                        <p>Create your first event to get started!</p>
                    </div>
                ) : (
                    <>
                        {/* Live Events */}
                        {liveEvents.length > 0 && (
                            <section className="events-section">
                                <h2 className="section-title">
                                    <span className="live-dot" />
                                    Live Events
                                </h2>
                                <div className="events-grid">
                                    {liveEvents.map(event => (
                                        <div key={event.id} className="event-card-wrapper">
                                            <EventCard
                                                event={event}
                                                onClose={handleCloseEvent}
                                                onRunAgents={handleRunAgents}
                                                agentRunning={!!agentRunning[event.id]}
                                            />
                                            {/* Agent Count Picker */}
                                            {showAgentPicker[event.id] && !agentRunning[event.id] && (
                                                <div className="agent-picker">
                                                    <div className="agent-picker-header">
                                                        <Bot size={16} />
                                                        <span>How many AI agents?</span>
                                                    </div>
                                                    <div className="agent-picker-controls">
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={50}
                                                            value={agentCount[event.id] || 5}
                                                            onChange={e => setAgentCount(prev => ({ ...prev, [event.id]: Number(e.target.value) }))}
                                                            className="agent-slider"
                                                        />
                                                        <span className="agent-count-display">{agentCount[event.id] || 5}</span>
                                                    </div>
                                                    <div className="agent-picker-info">
                                                        ~{((agentCount[event.id] || 5) * 0.1).toFixed(1)} MON needed for gas
                                                    </div>
                                                    <div className="agent-picker-actions">
                                                        <button
                                                            className="agent-picker-btn cancel"
                                                            onClick={() => setShowAgentPicker(prev => ({ ...prev, [event.id]: false }))}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            className="agent-picker-btn confirm"
                                                            onClick={() => handleConfirmAgents(event)}
                                                        >
                                                            Run {agentCount[event.id] || 5} Agents
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Agent Result Banner */}
                                            {agentResults[event.id] && (
                                                <div className="agent-result-banner success">
                                                    <CheckCircle2 size={16} />
                                                    <span>
                                                        AI Agents voted! {agentResults[event.id].successCount} agents succeeded,{' '}
                                                        {agentResults[event.id].skipCount} skipped
                                                    </span>
                                                </div>
                                            )}
                                            {agentError[event.id] && (
                                                <div className="agent-result-banner error">
                                                    <AlertCircle size={16} />
                                                    <span>{agentError[event.id]}</span>
                                                </div>
                                            )}
                                            {agentRunning[event.id] && (
                                                <div className="agent-result-banner running">
                                                    <Bot size={16} className="spin" />
                                                    <span>AI Agents evaluating & voting on-chain...</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Draft Events */}
                        {draftEvents.length > 0 && (
                            <section className="events-section">
                                <h2 className="section-title">Drafts</h2>
                                <div className="events-grid">
                                    {draftEvents.map(event => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Past Events */}
                        {pastEvents.length > 0 && (
                            <section className="events-section">
                                <h2 className="section-title">Past Events</h2>
                                <div className="events-grid">
                                    {pastEvents.map(event => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
