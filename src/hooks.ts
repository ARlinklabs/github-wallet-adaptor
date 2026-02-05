/**
 * AO Wallet Connector - React Hooks
 * 
 * Simplified hooks API for wallet interaction.
 */

import { useState, useEffect, useCallback, useContext } from 'react';
import { walletManager } from './manager';
import { WalletContext, SignerContext, WAuthContext } from './context';
import { createAoSigner } from './signer';
import { logger } from './logger';
import type {
    WalletConnectionState,
    WalletContextValue,
    SignerContextValue,
    AoSignerFunction,
    WAuthData,
} from './types';

/**
 * Hook that provides all wallet state and actions in one place.
 * This is the main hook to use for wallet interaction.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { connected, address, connect, disconnect } = useWallet();
 *   
 *   if (!connected) return <button onClick={connect}>Connect</button>;
 *   return <div>Connected: {address}</div>;
 * }
 * ```
 */
export function useWallet(): WalletContextValue {
    const context = useContext(WalletContext);

    if (context) {
        return context;
    }

    // Fallback if not using provider (standalone usage)
    const [state, setState] = useState<WalletConnectionState>(walletManager.getState());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        logger.debug('useWallet: Initial state:', walletManager.getState());

        const unsubscribe = walletManager.onStateChange((newState) => {
            logger.debug('useWallet: State changed:', newState);
            setState(newState);
        });
        return unsubscribe;
    }, []);

    const connect = useCallback(async (strategyId?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            if (strategyId) {
                walletManager.setStrategy(strategyId);
            }
            await walletManager.connect();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect wallet';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await walletManager.disconnect();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to disconnect wallet';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const setStrategy = useCallback((strategyId: string) => {
        return walletManager.setStrategy(strategyId);
    }, []);

    return {
        connected: state.connected,
        address: state.address,
        publicKey: state.publicKey,
        connect,
        disconnect,
        strategy: state.strategy,
        strategies: walletManager.getStrategies(),
        setStrategy,
        isLoading,
        error,
        isWAuth: walletManager.isWAuthStrategy(),
        isArweaveNative: walletManager.isArweaveNativeStrategy(),
        isMetaMask: walletManager.isMetaMaskStrategy(),
    };
}

/**
 * Hook that provides a ready-to-use AO signer.
 * The signer is automatically prepared - no need to call prepareAoSigner.
 * 
 * @example
 * ```tsx
 * import { useAoSigner } from '@/lib/ao-wallet-connector';
 * import { spawnProcess } from '@/lib/ao-vars';
 * 
 * function SpawnButton() {
 *   const { signer, isLoading } = useAoSigner();
 *   
 *   const handleSpawn = async () => {
 *     // Signer is already prepared!
 *     await spawnProcess("MyProcess", undefined, undefined, signer);
 *   };
 * }
 * ```
 */
export function useAoSigner(): SignerContextValue {
    const context = useContext(SignerContext);

    if (context) {
        return context;
    }

    // Fallback if not using provider
    const [signer, setSigner] = useState<AoSignerFunction | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const updateSigner = useCallback(async () => {
        setIsLoading(true);
        try {
            const rawSigner = await walletManager.getRawSigner();
            const preparedSigner = createAoSigner(rawSigner);
            // Wrap in arrow function to prevent React from calling it
            setSigner(() => preparedSigner);
        } catch (error) {
            logger.error('Failed to get signer:', error);
            setSigner(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        updateSigner();

        const unsubscribe = walletManager.onStateChange(() => {
            updateSigner();
        });

        return unsubscribe;
    }, [updateSigner]);

    return { signer, isLoading };
}

/**
 * Hook that provides the wallet address.
 * Use useWallet() if you need more than just the address.
 */
export function useAddress(): string | null {
    const [address, setAddress] = useState<string | null>(walletManager.getState().address);

    useEffect(() => {
        const unsubscribe = walletManager.onStateChange((state) => {
            setAddress(state.address);
        });
        return unsubscribe;
    }, []);

    return address;
}

/**
 * Hook for WAuth-specific data (email, username).
 */
export function useWAuthData(): WAuthData {
    const context = useContext(WAuthContext);

    if (context) {
        return context;
    }

    // Fallback
    const [email, setEmail] = useState<{ email: string; verified: boolean } | null>(null);
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        const updateWAuthData = () => {
            try {
                setEmail(walletManager.getEmail());
                setUsername(walletManager.getUsername());
            } catch {
                // Not logged in yet
            }
        };

        updateWAuthData();
        walletManager.onAuthDataChange(updateWAuthData);

        const unsubscribe = walletManager.onStateChange(() => {
            updateWAuthData();
        });

        return unsubscribe;
    }, []);

    return { email, username };
}

/**
 * Hook to get wallet type information.
 */
export function useWalletType() {
    const [walletType, setWalletType] = useState({
        isWAuth: walletManager.isWAuthStrategy(),
        isArweaveNative: walletManager.isArweaveNativeStrategy(),
        isMetaMask: walletManager.isMetaMaskStrategy(),
        strategyId: walletManager.getCurrentStrategy()?.id || null,
    });

    useEffect(() => {
        const unsubscribe = walletManager.onStateChange(() => {
            setWalletType({
                isWAuth: walletManager.isWAuthStrategy(),
                isArweaveNative: walletManager.isArweaveNativeStrategy(),
                isMetaMask: walletManager.isMetaMaskStrategy(),
                strategyId: walletManager.getCurrentStrategy()?.id || null,
            });
        });

        return unsubscribe;
    }, []);

    return walletType;
}

/**
 * Hook for wallet modal control (for custom UI).
 */
export function useWalletModal() {
    const [isOpen, setIsOpen] = useState(false);

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        setOpen: setIsOpen,
    };
}

// Re-export types for convenience
export type { WalletContextValue, SignerContextValue, WAuthData };
