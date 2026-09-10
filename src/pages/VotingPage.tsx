import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Check, Vote, Zap, Wallet, ExternalLink, FileCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWallet } from '../hooks/useWallet';
import { useWalletClient, usePublicClient } from 'wagmi';
import { getEventById, type Event } from '../lib/eventService';
import {
    getVoterEventState,
    getEventSubmissionsForVoting,
    submitVotes,
    submitVotesOnChain,
    calculateVoteCost,
    type VoterEventState,
    type SubmissionWithVotes,
    type VoteAllocation,
} from '../lib/votingService';
import { botchainTestnet as botchain } from '../lib/wagmi';
import './VotingPage.css';

type PageState = 'loading' | 'voting' | 'signing' | 'confirming' | 'syncing' | 'success' | 'already_voted' | 'error';

export function VotingPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isConnected, ensureConnection, isOnCorrectChain } = useWallet();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient({ chainId: botchain.id });

    const [pageState, setPageState] = useState<PageState>('loading');
    const [event, setEvent] = useState<Event | null>(null);
    const [voterState, setVoterState] = useState<VoterEventState | null>(null);
    const [submissions, setSubmissions] = useState<SubmissionWithVotes[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);

    // Vote allocations: submission_id -> vote_count
    const [allocations, setAllocations] = useState<Record<string, number>>({});

    // Load event and voter state
    useEffect(() => {
        async function loadData() {
            if (!eventId || !user) return;

            try {
                // Load event
                const eventData = await getEventById(eventId);
                if (!eventData) {
                    setError('Event not found');
                    setPageState('error');
                    return;
                }
                setEvent(eventData);

                // Load voter state
                const state = await getVoterEventState(eventId, user.id);
                if (!state) {
                    setError('You have not joined this event');
                    setPageState('error');
                    return;
                }
                setVoterState(state);

                // Check if already voted
                if (state.has_voted) {
                    setPageState('already_voted');
                    return;
                }

                // Load submissions
                const subs = await getEventSubmissionsForVoting(eventId, user.id);
                setSubmissions(subs);
                setPageState('voting');
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load voting page');
                setPageState('error');
            }
        }

        loadData();
    }, [eventId, user]);

    // Calculate credits used in real-time
    const creditsUsed = useMemo(() => {
        return Object.values(allocations).reduce((sum, votes) => sum + calculateVoteCost(votes), 0);
    }, [allocations]);

    const totalCredits = voterState?.total_credits || 100;
    const remainingCredits = totalCredits - creditsUsed;

    const handleVoteChange = (submissionId: string, votes: number) => {
        // Calculate what the new total would be
        const currentCostForThis = calculateVoteCost(allocations[submissionId] || 0);
        const newCostForThis = calculateVoteCost(votes);
        const newTotalUsed = creditsUsed - currentCostForThis + newCostForThis;

        // Only allow if within budget
        if (newTotalUsed <= totalCredits) {
            setAllocations(prev => ({
                ...prev,
                [submissionId]: votes,
            }));
        }
    };

    const handleSubmitVotes = async () => {
        if (!eventId || !user) return;

        setError(null);

        const voteAllocations: VoteAllocation[] = Object.entries(allocations)
            .filter(([_, votes]) => votes > 0)
            .map(([submission_id, vote_count]) => ({ submission_id, vote_count }));

        if (voteAllocations.length === 0) {
            setError('Please allocate at least one vote');
            return;
        }

        // Step 1: Ensure wallet is connected
        if (!isConnected || !isOnCorrectChain) {
            setError('Please connect your wallet to Botchain first');
            const connected = await ensureConnection();
            if (!connected) return;
        }

        if (!walletClient || !publicClient) {
            setError('Wallet not ready. Please try again.');
            return;
        }

        // Step 2: Sign & send on-chain transaction
        setPageState('signing');

        const chainResult = await submitVotesOnChain(
            eventId,
            voteAllocations,
            walletClient,
            publicClient
        );

        if (!chainResult.success) {
            // User rejected or txn failed
            const msg = chainResult.error || 'Transaction failed';
            setError(msg.includes('User rejected') || msg.includes('denied')
                ? 'Transaction was rejected. Please approve in your wallet to submit votes.'
                : msg);
            setPageState('voting');
            return;
        }

        setTxHash(chainResult.txHash || null);
        setPageState('syncing');

        // Step 3: Store in Supabase for fast reads
        const dbResult = await submitVotes(eventId, user.id, voteAllocations);

        if (!dbResult.success) {
            // On-chain succeeded but DB failed — votes are safe on-chain
            console.warn('DB sync failed but on-chain votes recorded:', dbResult.error);
        }

        setPageState('success');
    };

    const getMaxVotesForSubmission = (submissionId: string) => {
        const currentVotes = allocations[submissionId] || 0;
        const creditsSansThis = creditsUsed - calculateVoteCost(currentVotes);
        const availableForThis = totalCredits - creditsSansThis;
        return Math.floor(Math.sqrt(availableForThis));
    };

    const renderContent = () => {
        switch (pageState) {
            case 'loading':
                return (
                    <div className="voting-loading">
                        <Loader2 size={40} className="spinning" />
                        <p>Loading voting page...</p>
                    </div>
                );

            case 'already_voted':
                return (
                    <div className="voting-already">
                        <Check size={48} />
                        <h2>You've Already Voted</h2>
                        <p>Your votes have been recorded for this event.</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/dashboard/voter')}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                );

            case 'voting':
                return (
                    <>
                        {/* Credit Tracker */}
                        <div className="credit-tracker">
                            <div className="credit-bar">
                                <div
                                    className="credit-fill"
                                    style={{ width: `${(creditsUsed / totalCredits) * 100}%` }}
                                />
                            </div>
                            <div className="credit-info">
                                <span className="credits-used">
                                    <Zap size={16} />
                                    {creditsUsed} used
                                </span>
                                <span className="credits-remaining">
                                    {remainingCredits} remaining
                                </span>
                            </div>
                        </div>

                        {/* Submissions List */}
                        {submissions.length === 0 ? (
                            <div className="no-submissions">
                                <p>No submissions available to vote on.</p>
                            </div>
                        ) : (
                            <div className="submissions-voting-list">
                                {submissions.map(submission => {
                                    const votes = allocations[submission.id] || 0;
                                    const cost = calculateVoteCost(votes);
                                    const maxVotes = getMaxVotesForSubmission(submission.id);

                                    return (
                                        <div key={submission.id} className="voting-submission">
                                            <div className="submission-info">
                                                <h3>{submission.project_title}</h3>
                                                {submission.description && (
                                                    <p>{submission.description}</p>
                                                )}
                                            </div>
                                            <div className="vote-controls">
                                                <button
                                                    className="vote-btn"
                                                    onClick={() => handleVoteChange(submission.id, Math.max(0, votes - 1))}
                                                    disabled={votes === 0}
                                                >
                                                    −
                                                </button>
                                                <div className="vote-display">
                                                    <span className="vote-count">{votes}</span>
                                                    <span className="vote-cost">({cost} credits)</span>
                                                </div>
                                                <button
                                                    className="vote-btn"
                                                    onClick={() => handleVoteChange(submission.id, votes + 1)}
                                                    disabled={votes >= maxVotes}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {error && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        {/* Wallet Connection Notice */}
                        {!isConnected && (
                            <div className="wallet-notice">
                                <Wallet size={16} />
                                <span>Connect your wallet to submit votes on-chain</span>
                            </div>
                        )}
                        {isConnected && !isOnCorrectChain && (
                            <div className="wallet-notice warning">
                                <AlertCircle size={16} />
                                <span>Switch to Botchain to submit votes</span>
                            </div>
                        )}

                        <div className="voting-actions">
                            <button
                                className="btn btn-primary btn-large"
                                onClick={handleSubmitVotes}
                                disabled={creditsUsed === 0}
                            >
                                <Vote size={20} />
                                Sign & Submit Votes
                            </button>
                            <p className="voting-note">
                                Your votes will be signed and recorded on the Botchain blockchain.
                            </p>
                        </div>
                    </>
                );

            case 'signing':
                return (
                    <div className="voting-loading">
                        <div className="txn-step-container">
                            <div className="txn-step active">
                                <div className="txn-step-icon signing">
                                    <Wallet size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Waiting for Signature</h3>
                                    <p>Please confirm the transaction in your wallet...</p>
                                </div>
                            </div>
                            <div className="txn-step pending">
                                <div className="txn-step-icon">
                                    <Loader2 size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Confirm on Botchain</h3>
                                    <p>Waiting for blockchain confirmation</p>
                                </div>
                            </div>
                            <div className="txn-step pending">
                                <div className="txn-step-icon">
                                    <FileCheck size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Finalize</h3>
                                    <p>Syncing results</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'confirming':
                return (
                    <div className="voting-loading">
                        <div className="txn-step-container">
                            <div className="txn-step done">
                                <div className="txn-step-icon">
                                    <Check size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Signed</h3>
                                </div>
                            </div>
                            <div className="txn-step active">
                                <div className="txn-step-icon confirming">
                                    <Loader2 size={24} className="spinning" />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Confirming on Botchain</h3>
                                    <p>Transaction is being confirmed on-chain...</p>
                                </div>
                            </div>
                            <div className="txn-step pending">
                                <div className="txn-step-icon">
                                    <FileCheck size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Finalize</h3>
                                    <p>Syncing results</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'syncing':
                return (
                    <div className="voting-loading">
                        <div className="txn-step-container">
                            <div className="txn-step done">
                                <div className="txn-step-icon">
                                    <Check size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Signed</h3>
                                </div>
                            </div>
                            <div className="txn-step done">
                                <div className="txn-step-icon">
                                    <Check size={24} />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Confirmed</h3>
                                </div>
                            </div>
                            <div className="txn-step active">
                                <div className="txn-step-icon confirming">
                                    <Loader2 size={24} className="spinning" />
                                </div>
                                <div className="txn-step-info">
                                    <h3>Syncing Results</h3>
                                    <p>Saving to leaderboard...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'success':
                return (
                    <div className="voting-success">
                        <div className="success-icon">
                            <Check size={40} />
                        </div>
                        <h2>Votes Recorded On-Chain</h2>
                        <p>Your votes have been permanently stored on the Botchain blockchain.</p>
                        <div className="votes-summary">
                            <div className="summary-row">
                                <span>Credits used</span>
                                <span className="summary-value">{creditsUsed}</span>
                            </div>
                            <div className="summary-row">
                                <span>Projects voted</span>
                                <span className="summary-value">
                                    {Object.values(allocations).filter(v => v > 0).length}
                                </span>
                            </div>
                        </div>
                        {txHash && (
                            <a
                                href={`https://scan.bohr.life/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx-link"
                            >
                                <ExternalLink size={14} />
                                View transaction on Explorer
                            </a>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/leaderboard/${eventId}`)}
                        >
                            View Leaderboard
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => navigate('/dashboard/voter')}
                            style={{ marginTop: '8px' }}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                );

            case 'error':
                return (
                    <div className="voting-error">
                        <AlertCircle size={48} />
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/dashboard/voter')}
                        >
                            Back to Dashboard
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="voting-page">
            <div className="container">
                {pageState !== 'success' && (
                    <button className="back-btn" onClick={() => navigate('/dashboard/voter')}>
                        <ArrowLeft size={20} />
                        Back
                    </button>
                )}

                {event && (
                    <div className="voting-header">
                        <h1>{event.name}</h1>
                        <p>Allocate your votes using Quadratic Voting</p>
                    </div>
                )}

                <div className="voting-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
