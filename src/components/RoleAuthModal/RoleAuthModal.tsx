import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Crown, Users, Vote, X } from 'lucide-react';
import type { UserRole } from '../../lib/supabase';
import './RoleAuthModal.css';

interface RoleAuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ROLES: { id: UserRole; title: string; description: string; icon: typeof Crown }[] = [
    {
        id: 'host',
        title: 'Host',
        description: 'Create and manage hackathon events',
        icon: Crown,
    },
    {
        id: 'submitter',
        title: 'Submitter',
        description: 'Submit projects to hackathons',
        icon: Users,
    },
    {
        id: 'voter',
        title: 'Voter',
        description: 'Judge and vote on submissions',
        icon: Vote,
    },
];

export function RoleAuthModal({ isOpen, onClose }: RoleAuthModalProps) {
    const { login } = usePrivy();
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleRoleSelect = async (role: UserRole) => {
        setIsLoading(true);

        // Store selected role in sessionStorage for use after auth
        sessionStorage.setItem('pending_role', role);

        try {
            // Trigger Privy login
            login();
        } finally {
            // Reset loading so buttons aren't permanently disabled if user cancels
            setIsLoading(false);
        }

        // Close modal (Privy will take over)
        onClose();
    };

    return (
        <div className="role-modal-overlay" onClick={onClose}>
            <div className="role-modal" onClick={(e) => e.stopPropagation()}>
                <button className="role-modal-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <h2 className="role-modal-title">Choose Your Role</h2>
                <p className="role-modal-subtitle">Select how you want to participate</p>

                <div className="role-modal-options">
                    {ROLES.map((role) => {
                        const Icon = role.icon;
                        return (
                            <button
                                key={role.id}
                                className="role-option"
                                onClick={() => handleRoleSelect(role.id)}
                                disabled={isLoading}
                            >
                                <div className="role-option-icon">
                                    <Icon size={24} />
                                </div>
                                <div className="role-option-content">
                                    <h3>{role.title}</h3>
                                    <p>{role.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
