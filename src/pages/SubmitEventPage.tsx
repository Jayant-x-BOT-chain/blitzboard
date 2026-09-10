import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import QRCode from 'qrcode';
import { WalletConnect } from '../components/WalletConnect';
import { useWallet } from '../hooks/useWallet';
import { EVENT_FACTORY_ADDRESS, EVENT_FACTORY_ABI } from '../lib/contract';
import {
    getEventById,
    markEventPendingSubmission,
    markEventLive,
    rollbackToDraft,
    generateEventCode,
    type Event
} from '../lib/eventService';
import './SubmitEventPage.css';

type SubmitStep = 'loading' | 'wallet' | 'confirm' | 'submitting' | 'success' | 'error';

export function SubmitEventPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { address, isConnected, isOnCorrectChain } = useWallet();

    const [event, setEvent] = useState<Event | null>(null);
    const [step, setStep] = useState<SubmitStep>('loading');
    const [error, setError] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [pendingEventCode, setPendingEventCode] = useState<string | null>(null);

    // Wagmi hooks for contract interaction
    const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
    const { isSuccess: txConfirmed, isLoading: txLoading, isError: txFailed } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    // Load event
    useEffect(() => {
        async function loadEvent() {
            if (!eventId) {
                setError('Event ID not found');
                setStep('error');
                return;
            }

            try {
                const data = await getEventById(eventId);
                if (!data) {
                    setError('Event not found');
                    setStep('error');
                    return;
                }
                setEvent(data);
                setStep('wallet');
            } catch (err) {
                console.error('Failed to load event:', err);
                setError('Failed to load event');
                setStep('error');
            }
        }

        loadEvent();
    }, [eventId]);

    // Check wallet status
    useEffect(() => {
        if (step === 'wallet' && isConnected && isOnCorrectChain) {
            setStep('confirm');
        }
    }, [isConnected, isOnCorrectChain, step]);

    // Handle transaction confirmation
    useEffect(() => {
        async function handleTxSuccess() {
            if (txConfirmed && event && pendingEventCode && txHash) {
                try {
                    // Generate QR code
                    const qrUrl = await QRCode.toDataURL(`https://blitzboard.xyz/join/${pendingEventCode}`, {
                        width: 280,
                        margin: 2,
                        color: { dark: '#000000', light: '#ffffff' },
                    });
                    setQrCodeUrl(qrUrl);

                    // Update Supabase with live status
                    await markEventLive(event.id, pendingEventCode, EVENT_FACTORY_ADDRESS, txHash);

                    setEvent(prev => prev ? { ...prev, event_code: pendingEventCode, status: 'live' } : null);
                    setStep('success');
                } catch (err: any) {
                    console.error('Failed to finalize:', err);
                    setError('Transaction succeeded but failed to update database');
                    setStep('error');
                }
            }
        }

        handleTxSuccess();
    }, [txConfirmed, event, pendingEventCode, txHash]);

    // Handle write error
    useEffect(() => {
        async function handleWriteError() {
            if (writeError && event) {
                console.error('Contract write error:', writeError);
                setError(writeError.message || 'Transaction failed');
                await rollbackToDraft(event.id);
                setStep('error');
            }
        }

        handleWriteError();
    }, [writeError, event]);

    // Handle transaction failure on-chain
    useEffect(() => {
        async function handleTxFailed() {
            if (txFailed && event) {
                setError('Transaction failed on-chain. Check block explorer for details.');
                await rollbackToDraft(event.id);
                setStep('error');
            }
        }
        
        handleTxFailed();
    }, [txFailed, event]);

    const handleSubmit = async () => {
        if (!event || !address) return;

        setStep('submitting');
        setError(null);

        try {
            // Step 1: Mark as pending (internal status for retry)
            await markEventPendingSubmission(event.id);

            // Step 2: Generate event code
            const eventCode = generateEventCode();
            setPendingEventCode(eventCode);

            console.log('Submitting to contract:', {
                eventId: event.id,
                eventCode,
                contract: EVENT_FACTORY_ADDRESS,
            });

            // Step 3: Call smart contract
            writeContract({
                address: EVENT_FACTORY_ADDRESS,
                abi: EVENT_FACTORY_ABI,
                functionName: 'createEvent',
                args: [event.id, eventCode],
            });

        } catch (err: any) {
            console.error('Submit failed:', err);
            setError(err.message || 'Failed to submit event');

            if (event) {
                await rollbackToDraft(event.id);
            }

            setStep('error');
        }
    };

    const renderContent = () => {
        switch (step) {
            case 'loading':
                return (
                    <div className="submit-loading">
                        <Loader2 size={40} className="spinning" />
                        <p>Loading event...</p>
                    </div>
                );

            case 'wallet':
                return (
                    <div className="submit-step">
                        <h2>Step 1: Connect Wallet</h2>
                        <p>Connect your wallet to submit this event</p>
                        <WalletConnect onSuccess={() => setStep('confirm')} />
                    </div>
                );

            case 'confirm':
                return (
                    <div className="submit-step">
                        <h2>Step 2: Confirm Submission</h2>
                        <div className="event-preview">
                            {event?.cover_image_url && (
                                <img src={event.cover_image_url} alt={event.name} className="preview-image" />
                            )}
                            <h3>{event?.name}</h3>
                            <p>{event?.description}</p>
                        </div>
                        <div className="confirm-note">
                            <Sparkles size={20} />
                            <p>Your event will be registered on Botchain blockchain. Participants can join using the generated code.</p>
                        </div>
                        <div className="submit-actions">
                            <button className="btn btn-outline" onClick={() => navigate(-1)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSubmit}>
                                Confirm & Go Live
                            </button>
                        </div>
                    </div>
                );

            case 'submitting':
                return (
                    <div className="submit-loading">
                        <Loader2 size={40} className="spinning" />
                        <p>{isPending ? 'Waiting for wallet...' : txLoading ? 'Confirming transaction...' : 'Submitting your event...'}</p>
                        <span className="submit-hint">
                            {isPending ? 'Please confirm the transaction in your wallet' : 'This may take a few seconds'}
                        </span>
                        {txHash && (
                            <a
                                href={`https://scan.bohr.life/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx-link"
                            >
                                View transaction →
                            </a>
                        )}
                    </div>
                );

            case 'success':
                return (
                    <div className="submit-success">
                        <div className="success-icon">
                            <Check size={40} />
                        </div>
                        <h2>Event is Live! 🎉</h2>
                        <p>Your event is now on the Botchain blockchain</p>

                        <div className="event-code-display">
                            <label>Event Code</label>
                            <div className="code">{event?.event_code}</div>
                        </div>

                        {qrCodeUrl && (
                            <div className="qr-display">
                                <label>QR Code for Submissions</label>
                                <img src={qrCodeUrl} alt="Event QR Code" />
                            </div>
                        )}

                        {txHash && (
                            <a
                                href={`https://scan.bohr.life/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tx-link success-tx"
                            >
                                View on Explorer →
                            </a>
                        )}

                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/dashboard/host')}
                        >
                            Go to Dashboard
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => navigate(`/leaderboard/${event?.id}`)}
                            style={{ marginTop: '8px' }}
                        >
                            View Leaderboard
                        </button>
                    </div>
                );

            case 'error':
                return (
                    <div className="submit-error">
                        <AlertCircle size={40} />
                        <h2>Something went wrong</h2>
                        <p>{error}</p>
                        <div className="error-actions">
                            <button className="btn btn-outline" onClick={() => navigate('/dashboard/host')}>
                                Back to Dashboard
                            </button>
                            <button className="btn btn-primary" onClick={() => setStep('wallet')}>
                                Try Again
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="submit-event-page">
            <div className="container">
                {step !== 'success' && (
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                        Back
                    </button>
                )}

                <div className="submit-header">
                    <h1>Submit Event</h1>
                    {event && <p className="event-name">{event.name}</p>}
                </div>

                <div className="submit-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
