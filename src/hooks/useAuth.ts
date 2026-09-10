import { usePrivy } from '@privy-io/react-auth';
import { useState, useEffect } from 'react';
import { getUserByPrivyId, createUser, type User, type UserRole } from '../lib/supabase';

export function useAuth() {
    const { ready, authenticated, user: privyUser, login, logout } = usePrivy();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [shouldRedirect, setShouldRedirect] = useState<string | null>(null);

    useEffect(() => {
        async function handleAuth() {
            if (!ready) return;

            if (!authenticated || !privyUser) {
                setUser(null);
                setLoading(false);
                setShouldRedirect(null);
                return;
            }

            try {
                // Check if user exists in Supabase
                const dbUser = await getUserByPrivyId(privyUser.id);

                if (dbUser && dbUser.role) {
                    // User exists with a role - set user and trigger redirect
                    setUser(dbUser);
                    setShouldRedirect(`/dashboard/${dbUser.role}`);
                    setLoading(false);
                    return;
                }

                // Check if there's a pending role from the auth modal
                const pendingRole = sessionStorage.getItem('pending_role') as UserRole | null;

                if (pendingRole) {
                    // New user with pending role - create in Supabase
                    const email = privyUser.email?.address || null;
                    const wallet = privyUser.wallet?.address || null;

                    console.log('Creating user with role:', pendingRole);
                    const newUser = await createUser(privyUser.id, email, wallet, pendingRole);

                    if (newUser) {
                        setUser(newUser);
                        sessionStorage.removeItem('pending_role');
                        console.log('User created successfully:', newUser);
                        // Trigger redirect after successful creation
                        setShouldRedirect(`/dashboard/${pendingRole}`);
                    } else {
                        console.error('Failed to create user in Supabase');
                    }
                } else if (dbUser && !dbUser.role) {
                    // User exists but no role - should not happen in new flow
                    console.warn('User exists without role');
                    setUser(null);
                }

                setLoading(false);
            } catch (error: any) {
                console.error('Error in auth flow:', error);
                setLoading(false);
            }
        }

        handleAuth();
    }, [ready, authenticated, privyUser]);

    return {
        ready,
        authenticated,
        privyUser,
        user,
        loading,
        shouldRedirect,
        login,
        logout,
        setUser,
        clearRedirect: () => setShouldRedirect(null),
    };
}
