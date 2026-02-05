/**
 * AO Wallet Connector - Provider
 * 
 * Single provider that handles all wallet state, auto-reconnect, and signer preparation.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { walletManager } from './manager';
import { WalletContext, SignerContext, WAuthContext } from './context';
import { createAoSigner } from './signer';
import { setDebugMode, logger } from './logger';
import { DEFAULT_PERMISSIONS } from './constants';
import type {
    AoWalletProviderConfig,
    WalletConnectionState,
    WalletContextValue,
    SignerContextValue,
    AoSignerFunction,
    WAuthData,
} from './types';

interface AoWalletProviderProps extends AoWalletProviderConfig {
    children: React.ReactNode;
}

/**
 * AoWalletProvider - Single provider for all wallet functionality.
 * 
 * Handles:
 * - Auto-reconnect on mount
 * - State management
 * - Signer preparation
 * - Connection edge case fixes
 * 
 * @example
 * ```tsx
 * import { AoWalletProvider } from '@/lib/ao-wallet-connector';
 * 
 * ReactDOM.createRoot(document.getElementById("root")!).render(
 *   <AoWalletProvider debug={import.meta.env.DEV}>
 *     <App />
 *   </AoWalletProvider>
 * );
 * ```
 */
export function AoWalletProvider({
    children,
    debug = false,
    permissions = DEFAULT_PERMISSIONS as unknown as string[],
    autoConnect = true,
}: AoWalletProviderProps) {
    // Set debug mode
    useEffect(() => {
        setDebugMode(debug);
    }, [debug]);

    // Wallet state
    const [state, setState] = useState<WalletConnectionState>(walletManager.getState());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Signer state
    const [signer, setSigner] = useState<AoSignerFunction | null>(null);
    const [signerLoading, setSignerLoading] = useState(false);

    // WAuth state
    const [wauthData, setWauthData] = useState<WAuthData>({
        email: null,
        username: null,
    });

    // Refs to prevent multiple auto-connects
    const autoConnectAttempted = useRef(false);
    const disconnectRef = useRef<() => Promise<void>>();

    // Subscribe to state changes
    useEffect(() => {
        const unsubscribe = walletManager.onStateChange((newState) => {
            logger.debug('Provider: State changed', newState);
            setState(newState);
        });
        return unsubscribe;
    }, []);

    // Update signer when state changes
    const updateSigner = useCallback(async () => {
        setSignerLoading(true);
        try {
            const rawSigner = await walletManager.getRawSigner();
            const preparedSigner = createAoSigner(rawSigner);
            setSigner(() => preparedSigner);
        } catch (error) {
            logger.error('Failed to update signer:', error);
            setSigner(null);
        } finally {
            setSignerLoading(false);
        }
    }, []);

    useEffect(() => {
        updateSigner();

        const unsubscribe = walletManager.onStateChange(() => {
            updateSigner();
        });

        return unsubscribe;
    }, [updateSigner]);

    // Update WAuth data
    useEffect(() => {
        const updateWAuthData = () => {
            try {
                setWauthData({
                    email: walletManager.getEmail(),
                    username: walletManager.getUsername(),
                });
            } catch {
                // Not logged in yet
            }
        };

        updateWAuthData();
        walletManager.onAuthDataChange(updateWAuthData);

        const unsubscribe = walletManager.onStateChange(() => {
            if (walletManager.isWAuthStrategy()) {
                updateWAuthData();
            }
        });

        return unsubscribe;
    }, []);

    // Auto-reconnect on mount
    useEffect(() => {
        if (!autoConnect || autoConnectAttempted.current || state.connected) {
            return;
        }

        autoConnectAttempted.current = true;

        walletManager.autoReconnect().catch((error) => {
            logger.warn('Auto-reconnect error:', error);
        });
    }, [autoConnect, state.connected]);

    // Fix connection edge cases (connected but no address)
    useEffect(() => {
        if (state.connected && !state.address) {
            logger.warn('Connected but no address - disconnecting');
            disconnectRef.current?.();
        }
    }, [state.connected, state.address]);

    // Connect function
    const connect = useCallback(async (strategyId?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            if (strategyId) {
                walletManager.setStrategy(strategyId);
            }
            await walletManager.connect(permissions);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect wallet';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [permissions]);

    // Disconnect function
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

    // Keep disconnect ref updated
    useEffect(() => {
        disconnectRef.current = disconnect;
    }, [disconnect]);

    // Set strategy function
    const setStrategy = useCallback((strategyId: string) => {
        return walletManager.setStrategy(strategyId);
    }, []);

    // Build context values
    const walletContextValue: WalletContextValue = {
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

    const signerContextValue: SignerContextValue = {
        signer,
        isLoading: signerLoading,
    };

    return (
        <WalletContext.Provider value={walletContextValue}>
            <SignerContext.Provider value={signerContextValue}>
                <WAuthContext.Provider value={wauthData}>
                    {children}
                </WAuthContext.Provider>
            </SignerContext.Provider>
        </WalletContext.Provider>
    );
}

export default AoWalletProvider;
