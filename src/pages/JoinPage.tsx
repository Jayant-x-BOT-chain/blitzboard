import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { validateEventCode } from '../lib/submissionService';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { RoleAuthModal } from '../components/RoleAuthModal';

/**
 * /join/:code - Landing page for QR code scans
 * Routes users to the correct flow based on their role:
 * - Submitters → /submit/:eventId
 * - Voters → /vote/:eventId (after joining the event)
 * - Unauthenticated → show role selection modal
 */
export function JoinPage() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { authenticated, user, ready, loading } = useAuth();

    const [validating, setValidating] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [eventId, setEventId] = useState<string | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);

    // Validate the event code
    useEffect(() => {
        async function validate() {
            if (!code) {
                setError('No event code provided');
                setValidating(false);
                return;
            }

            try {
                const result = await validateEventCode(code);
                if (!result.valid || !result.event) {
                    setError(result.error || 'Invalid event code');
                    setValidating(false);
                    return;
                }

                setEventId(result.event.id);
                setValidating(false);
            } catch (err) {
                console.error('Error validating event code:', err);
                setError('Failed to validate event code');
                setValidating(false);
            }
        }

        validate();
    }, [code]);

    // Redirect authenticated users based on role once event is validated
    useEffect(() => {
        if (!ready || loading || validating || !eventId) return;

        if (!authenticated || !user?.role) {
            // Not logged in — show role modal
            setShowRoleModal(true);
            return;
        }

        // Route based on role
        switch (user.role) {
            case 'submitter':
                navigate(`/submit/${eventId}`, { replace: true });
                break;
            case 'voter':
                navigate(`/vote/${eventId}`, { replace: true });
                break;
            case 'host':
                navigate(`/leaderboard/${eventId}`, { replace: true });
                break;
            default:
                navigate('/', { replace: true });
        }
    }, [ready, loading, authenticated, user, validating, eventId, navigate]);

    return (
        <div className="app">
            <Header />
            <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {validating || loading || !ready ? (
                    <div style={{ textAlign: 'center' }}>
                        <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: 'monospace', marginTop: '16px' }}>
                            Validating event code...
                        </p>
                    </div>
                ) : error ? (
                    <div style={{ textAlign: 'center' }}>
                        <AlertCircle size={48} style={{ color: '#ef4444' }} />
                        <h2 style={{ marginTop: '16px', fontFamily: 'monospace' }}>Invalid Event</h2>
                        <p style={{ color: '#666', marginTop: '8px' }}>{error}</p>
                        <button
                            className="btn btn-primary"
                            style={{ marginTop: '24px' }}
                            onClick={() => navigate('/')}
                        >
                            Go Home
                        </button>
                    </div>
                ) : (
                    <div style={{ textAlign: 'center' }}>
                        <Zap size={48} style={{ color: '#d4ff4f' }} />
                        <h2 style={{ marginTop: '16px', fontFamily: 'monospace' }}>
                            Join Event
                        </h2>
                        <p style={{ color: '#666', marginTop: '8px' }}>
                            Sign in to participate in this event
                        </p>
                    </div>
                )}
            </main>
            <Footer />
            <RoleAuthModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
        </div>
    );
}
