import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Loader2, ExternalLink, RefreshCw, Users, Bot, Layers, Zap, Crown, Medal, Award, CheckCircle, Clock, Circle } from 'lucide-react';
import { getEventById, type Event } from '../lib/eventService';
import { getEventVotingStatus, subscribeToLeaderboard } from '../lib/leaderboardService';
import {
    getHybridLeaderboard,
    rankByScoreType,
    syncAgentVotesFromChain,
    getAgentVotingMetrics,
    type HybridLeaderboardEntry,
} from '../lib/agentVotingService';
import './LeaderboardPage.css';

type LeaderboardTab = 'human' | 'agent' | 'combined';

const TABS: { id: LeaderboardTab; label: string; icon: typeof Users; description: string }[] = [
    { id: 'human', label: 'Human Votes', icon: Users, description: 'Scored by human voters using quadratic voting' },
    { id: 'agent', label: 'AI Agents', icon: Bot, description: 'Scored by AI agent consensus (on-chain)' },
    { id: 'combined', label: 'Combined', icon: Layers, description: 'Human + AI agent scores merged' },
];

export function LeaderboardPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<Event | null>(null);
    const [allEntries, setAllEntries] = useState<HybridLeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('combined');
    const [agentMetrics, setAgentMetrics] = useState<{
        totalAgentVotes: number;
        uniqueAgents: number;
        avgVotesPerAgent: number;
    } | null>(null);

    // Get ranked entries for the active tab
    const rankedEntries = rankByScoreType(allEntries, activeTab);

    // Load all data
    const loadData = useCallback(async () => {
        if (!eventId) return;

        try {
            const [eventData, hybridData, metrics] = await Promise.all([
                getEventById(eventId),
                getHybridLeaderboard(eventId),
                getAgentVotingMetrics(eventId),
            ]);

            setEvent(eventData);
            setAllEntries(hybridData);
            setAgentMetrics(metrics);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Error loading leaderboard:', err);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    // Sync agent votes from chain then reload
    const handleSyncAgentVotes = useCallback(async () => {
        if (!eventId || syncing) return;
        setSyncing(true);
        try {
            const result = await syncAgentVotesFromChain(eventId);
            console.log(`Synced ${result.synced} agent votes from chain`);
            if (result.synced > 0) {
                await loadData();
            }
        } catch (err) {
            console.error('Error syncing agent votes:', err);
        } finally {
            setSyncing(false);
        }
    }, [eventId, syncing, loadData]);

    useEffect(() => {
        loadData();

        if (eventId) {
            // Subscribe to real-time Supabase updates (human votes)
            const unsubscribe = subscribeToLeaderboard(eventId, loadData);

            // Poll every 10s (catches agent votes too)
            const pollInterval = setInterval(loadData, 10000);

            // Sync agent votes from chain on first load
            syncAgentVotesFromChain(eventId).then(result => {
                if (result.synced > 0) loadData();
            });

            return () => {
                unsubscribe();
                clearInterval(pollInterval);
            };
        }
    }, [eventId, loadData]);

    const votingStatus = event ? getEventVotingStatus(event) : 'upcoming';

    const getStatusBadge = () => {
        switch (votingStatus) {
            case 'live_voting':
                return <span className="status-badge live"><Circle size={10} className="live-indicator" /> LIVE VOTING</span>;
            case 'voting_closed':
                return <span className="status-badge closed"><CheckCircle size={14} /> FINAL RESULTS</span>;
            default:
                return <span className="status-badge upcoming"><Clock size={14} /> UPCOMING</span>;
        }
    };

    const getRankDisplay = (rank: number) => {
        switch (rank) {
            case 1: return <span className="rank gold"><Crown size={20} /></span>;
            case 2: return <span className="rank silver"><Medal size={20} /></span>;
            case 3: return <span className="rank bronze"><Award size={20} /></span>;
            default: return <span className="rank">{rank}</span>;
        }
    };

    const getScoreForTab = (entry: HybridLeaderboardEntry): number => {
        switch (activeTab) {
            case 'human': return entry.human_score;
            case 'agent': return entry.agent_score;
            case 'combined': return entry.combined_score;
        }
    };

    const getVoterInfoForTab = (entry: HybridLeaderboardEntry): string => {
        switch (activeTab) {
            case 'human': return `${entry.human_voter_count} voter${entry.human_voter_count !== 1 ? 's' : ''}`;
            case 'agent': return `${entry.agent_voter_count} agent${entry.agent_voter_count !== 1 ? 's' : ''}`;
            case 'combined': return `${entry.human_voter_count + entry.agent_voter_count} total`;
        }
    };

    if (loading) {
        return (
            <div className="leaderboard-page">
                <div className="container">
                    <div className="loading-state">
                        <Loader2 size={40} className="spinning" />
                        <p>Loading leaderboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="leaderboard-page">
            <div className="container">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    Back
                </button>

                {/* Event Header */}
                <div className="leaderboard-header">
                    <div className="header-content">
                        <Trophy size={32} className="trophy-icon" />
                        <div>
                            <h1>{event?.name || 'Event'}</h1>
                            {getStatusBadge()}
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            className="sync-btn"
                            onClick={handleSyncAgentVotes}
                            disabled={syncing}
                            title="Sync agent votes from blockchain"
                        >
                            {syncing ? (
                                <Loader2 size={14} className="spinning" />
                            ) : (
                                <Zap size={14} />
                            )}
                            {syncing ? 'Syncing...' : 'Sync On-Chain'}
                        </button>
                        <div className="last-update">
                            <RefreshCw size={14} />
                            Updated {lastUpdate.toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Voting Metrics Bar */}
                {agentMetrics && (agentMetrics.uniqueAgents > 0 || allEntries.some(e => e.human_score > 0)) && (
                    <div className="metrics-bar">
                        <div className="metric">
                            <Users size={16} />
                            <span className="metric-value">
                                {new Set(allEntries.flatMap(e => Array(e.human_voter_count).fill(0))).size || allEntries.reduce((max, e) => Math.max(max, e.human_voter_count), 0)}
                            </span>
                            <span className="metric-label">Human Voters</span>
                        </div>
                        <div className="metric">
                            <Bot size={16} />
                            <span className="metric-value">{agentMetrics.uniqueAgents}</span>
                            <span className="metric-label">AI Agents</span>
                        </div>
                        <div className="metric">
                            <Zap size={16} />
                            <span className="metric-value">{agentMetrics.totalAgentVotes}</span>
                            <span className="metric-label">Agent Votes</span>
                        </div>
                        <div className="metric">
                            <Layers size={16} />
                            <span className="metric-value">
                                {allEntries.reduce((sum, e) => sum + e.combined_score, 0)}
                            </span>
                            <span className="metric-label">Total Score</span>
                        </div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="leaderboard-tabs">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={18} />
                                <span className="tab-label">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab Description */}
                <p className="tab-description">
                    {TABS.find(t => t.id === activeTab)?.description}
                </p>

                {/* Leaderboard Table */}
                {rankedEntries.length === 0 || rankedEntries.every(e => getScoreForTab(e) === 0) ? (
                    <div className="empty-leaderboard">
                        <Trophy size={48} />
                        <h3>No votes yet</h3>
                        <p>
                            {activeTab === 'agent'
                                ? 'No AI agents have voted yet. Run the agent runner to start agent consensus.'
                                : activeTab === 'human'
                                    ? 'No human voters have submitted votes yet.'
                                    : 'Be the first to submit and vote!'}
                        </p>
                    </div>
                ) : (
                    <div className="leaderboard-table">
                        <div className="table-header">
                            <span className="col-rank">Rank</span>
                            <span className="col-project">Project</span>
                            <span className="col-voters">Voters</span>
                            <span className="col-score">Score</span>
                        </div>
                        {rankedEntries.map(entry => {
                            const score = getScoreForTab(entry);
                            if (score === 0 && activeTab !== 'combined') return null;

                            return (
                                <div
                                    key={entry.submission_id}
                                    className={`table-row ${entry.rank <= 3 ? 'top-three' : ''}`}
                                >
                                    <span className="col-rank">
                                        {getRankDisplay(entry.rank)}
                                    </span>
                                    <span className="col-project">
                                        <span className="project-title">{entry.project_title}</span>
                                        {entry.project_link && (
                                            <a
                                                href={entry.project_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="project-link-icon"
                                            >
                                                <ExternalLink size={14} />
                                            </a>
                                        )}
                                    </span>
                                    <span className="col-voters">
                                        {getVoterInfoForTab(entry)}
                                    </span>
                                    <span className="col-score">
                                        <span className="score-main">{score}</span>
                                        {activeTab === 'combined' && (entry.human_score > 0 || entry.agent_score > 0) && (
                                            <span className="score-breakdown">
                                                {entry.human_score > 0 && (
                                                    <span className="score-human" title="Human votes">
                                                        <Users size={12} />
                                                        {entry.human_score}
                                                    </span>
                                                )}
                                                {entry.agent_score > 0 && (
                                                    <span className="score-agent" title="Agent votes">
                                                        <Bot size={12} />
                                                        {entry.agent_score}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
