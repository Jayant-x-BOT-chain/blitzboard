import { createClient } from '@supabase/supabase-js';

// Use placeholder values if env vars are not set (allows app to load)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'host' | 'voter' | 'submitter';

export interface User {
    id: string;
    privy_user_id: string;
    email: string | null;
    wallet_address: string | null;
    role: UserRole | null;
    created_at: string;
}

export async function getUserByPrivyId(privyUserId: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('privy_user_id', privyUserId)
        .maybeSingle(); // Use maybeSingle to avoid 406 when no rows found

    if (error) {
        console.error('Error fetching user:', error);
        throw error; // Throw to let useAuth catch it
    }

    return data;
}

export async function createUser(
    privyUserId: string,
    email: string | null,
    walletAddress: string | null,
    role: UserRole
): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .insert({
            privy_user_id: privyUserId,
            email,
            wallet_address: walletAddress,
            role,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating user:', error);
        return null;
    }

    return data;
}
