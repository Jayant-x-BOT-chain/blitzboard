import { Zap, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { RoleAuthModal } from '../RoleAuthModal';
import './Header.css';

export function Header() {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const { authenticated, user, logout } = useAuth();

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show header if scrolling up or at the top
            if (currentScrollY < lastScrollY || currentScrollY < 50) {
                setIsVisible(true);
            } else {
                // Hide header if scrolling down and not at top
                setIsVisible(false);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <>
            <header className={`header ${isVisible ? 'visible' : 'hidden'}`}>
                <div className="container header-container">
                    <a href="/" className="logo">
                        <div className="logo-icon">
                            <Zap size={20} strokeWidth={2.5} />
                        </div>
                        <span className="logo-text">BlitzBoard</span>
                    </a>

                    <nav className="nav">
                        {authenticated ? (
                            <>
                                <span className="nav-user">
                                    {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                                </span>
                                <button
                                    onClick={logout}
                                    className="btn btn-outline btn-sm"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <LogOut size={16} />
                                    Logout
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setShowRoleModal(true)}
                                className="btn btn-outline btn-sm"
                            >
                                Sign in
                            </button>
                        )}
                    </nav>
                </div>
            </header>

            <RoleAuthModal
                isOpen={showRoleModal}
                onClose={() => setShowRoleModal(false)}
            />
        </>
    );
}
