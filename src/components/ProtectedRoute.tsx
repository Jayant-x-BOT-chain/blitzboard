import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRole?: 'host' | 'voter' | 'submitter';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const { ready, authenticated, user, loading } = useAuth();

    if (!ready || loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fffbf5'
            }}>
                <p style={{ fontFamily: 'monospace', fontSize: '18px' }}>Loading...</p>
            </div>
        );
    }

    // Not authenticated - redirect to home
    if (!authenticated) {
        return <Navigate to="/" replace />;
    }

    // No user record yet (still processing) - wait
    if (!user) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fffbf5'
            }}>
                <p style={{ fontFamily: 'monospace', fontSize: '18px' }}>Setting up your account...</p>
            </div>
        );
    }

    // Wrong role - redirect to correct dashboard
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to={`/dashboard/${user.role}`} replace />;
    }

    return <>{children}</>;
}
