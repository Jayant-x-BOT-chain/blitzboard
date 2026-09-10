import { useAuth } from '../../hooks/useAuth';
import './ProfileCard.css';

export function ProfileCard() {
    const { user, privyUser } = useAuth();

    return (
        <div className="profile-card">
            <div className="profile-header">
                <h2>Profile</h2>
                <span className="role-badge">{user?.role}</span>
            </div>

            <div className="profile-info">
                <div className="profile-field">
                    <label>Email</label>
                    <p>{user?.email || privyUser?.email?.address || 'Not provided'}</p>
                </div>

                {user?.wallet_address && (
                    <div className="profile-field">
                        <label>Wallet</label>
                        <p className="wallet-address">
                            {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
