import { useAccount, useDisconnect, useSwitchChain, useChainId } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useState, useCallback } from 'react';
import { TARGET_CHAIN_ID, botchain } from '../lib/wagmi';

export function useWallet() {
    const { address, isConnected, isConnecting } = useAccount();
    const { disconnect } = useDisconnect();
    const { switchChainAsync } = useSwitchChain();
    const chainId = useChainId();
    const { openConnectModal } = useConnectModal();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if on the correct chain (Botchain)
    const isOnCorrectChain = chainId === TARGET_CHAIN_ID;

    // Connect wallet and ensure correct chain
    const connectWallet = useCallback(async (): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        try {
            if (!isConnected) {
                // Open RainbowKit modal
                if (openConnectModal) {
                    openConnectModal();
                    setIsLoading(false);
                    return false; // User will complete connection via modal
                }
                throw new Error('Connect modal not available');
            }

            // If connected but on wrong chain, switch
            if (!isOnCorrectChain) {
                await switchChainAsync({ chainId: TARGET_CHAIN_ID });
            }

            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error('Wallet connection error:', err);
            setError(err.message || 'Failed to connect wallet');
            setIsLoading(false);
            return false;
        }
    }, [isConnected, isOnCorrectChain, openConnectModal, switchChainAsync]);

    // Switch to Botchain
    const switchToBotchain = useCallback(async (): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        try {
            await switchChainAsync({ chainId: TARGET_CHAIN_ID });
            setIsLoading(false);
            return true;
        } catch (err: any) {
            console.error('Chain switch error:', err);
            setError(err.message || 'Failed to switch network');
            setIsLoading(false);
            return false;
        }
    }, [switchChainAsync]);

    // Ensure wallet is connected and on correct chain
    const ensureConnection = useCallback(async (): Promise<boolean> => {
        if (!isConnected) {
            return connectWallet();
        }
        if (!isOnCorrectChain) {
            return switchToBotchain();
        }
        return true;
    }, [isConnected, isOnCorrectChain, connectWallet, switchToBotchain]);

    return {
        address,
        isConnected,
        isConnecting,
        isLoading,
        isOnCorrectChain,
        chainId,
        targetChain: botchain,
        error,
        connectWallet,
        switchToBotchain,
        ensureConnection,
        disconnect,
        clearError: () => setError(null),
    };
}
