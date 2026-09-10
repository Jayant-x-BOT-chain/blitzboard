import { Wallet, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import './WalletConnect.css';

interface WalletConnectProps {
    onSuccess?: () => void;
}

export function WalletConnect({ onSuccess }: WalletConnectProps) {
    const {
        isConnected,
        isLoading,
        isOnCorrectChain,
        address,
        targetChain,
        error,
        ensureConnection,
        switchToBotchain,
        clearError,
    } = useWallet();

    const handleConnect = async () => {
        clearError();
        const success = await ensureConnection();
        if (success && onSuccess) {
            onSuccess();
        }
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    // Connected and on correct chain
    if (isConnected && isOnCorrectChain) {
        return (
            <div className="wallet-status connected">
                <Check size={20} />
                <span>Connected: {formatAddress(address!)}</span>
            </div>
        );
    }

    // Connected but wrong chain
    if (isConnected && !isOnCorrectChain) {
        return (
            <div className="wallet-prompt">
                <div className="wallet-warning">
                    <AlertTriangle size={20} />
                    <span>Please switch to {targetChain.name}</span>
                </div>
                <button
                    className="wallet-btn"
                    onClick={switchToBotchain}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <RefreshCw size={18} className="spinning" />
                            Switching...
                        </>
                    ) : (
                        <>
                            <RefreshCw size={18} />
                            Switch Network
                        </>
                    )}
                </button>
                {error && <p className="wallet-error">{error}</p>}
            </div>
        );
    }

    // Not connected
    return (
        <div className="wallet-prompt">
            <p className="wallet-message">
                Connect your wallet to submit this event to the blockchain
            </p>
            <button
                className="wallet-btn"
                onClick={handleConnect}
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <RefreshCw size={18} className="spinning" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <Wallet size={18} />
                        Connect Wallet
                    </>
                )}
            </button>
            {error && <p className="wallet-error">{error}</p>}
        </div>
    );
}
