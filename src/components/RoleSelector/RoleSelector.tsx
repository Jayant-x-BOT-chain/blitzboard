import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { createUser, type UserRole } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import './RoleSelector.css';

const roles: { value: UserRole; label: string; description: string }[] = [
    { value: 'host', label: 'Host', description: 'Create and manage events' },
    { value: 'voter', label: 'Voter', description: 'Vote on projects' },
    { value: 'submitter', label: 'Submitter', description: 'Submit projects' },
];

export function RoleSelector() {
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [saving, setSaving] = useState(false);
    const { user: privyUser } = usePrivy();
    const { setUser } = useAuth();
    const navigate = useNavigate();

    const handleRoleSelect = async (role: UserRole) => {
        if (!privyUser || saving) return;

        setSelectedRole(role);
        setSaving(true);

        try {
            const email = privyUser.email?.address || null;
            const walletAddress = privyUser.wallet?.address || null;

            const newUser = await createUser(privyUser.id, email, walletAddress, role);

            if (newUser) {
                setUser(newUser);

                // Route to dashboard based on role
                navigate(`/dashboard/${role}`);
            } else {
                alert('Failed to save role. Please try again.');
                setSaving(false);
                setSelectedRole(null);
            }
        } catch (error) {
            console.error('Error saving role:', error);
            alert('Failed to save role. Please try again.');
            setSaving(false);
            setSelectedRole(null);
        }
    };

    return (
        <div className="role-selector-container">
            <div className="role-selector-content">
                <h1 className="role-selector-title">Choose Your Role</h1>
                <p className="role-selector-subtitle">Select how you want to participate</p>

                <div className="role-cards">
                    {roles.map((role) => (
                        <button
                            key={role.value}
                            className={`role-card ${selectedRole === role.value ? 'selected' : ''}`}
                            onClick={() => handleRoleSelect(role.value)}
                            disabled={saving}
                        >
                            <h3 className="role-card-title">{role.label}</h3>
                            <p className="role-card-description">{role.description}</p>
                        </button>
                    ))}
                </div>

                {saving && <p className="role-selector-saving">Saving...</p>}
            </div>
        </div>
    );
}
