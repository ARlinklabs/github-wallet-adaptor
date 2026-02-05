/**
 * AO Wallet Connector
 * 
 * A simplified wallet connection library for AO applications.
 * Similar API to ArweaveWalletKit but with auto-prepared signers.
 * 
 * @example
 * ```tsx
 * // main.tsx
 * import { AoWalletProvider } from '@/lib/ao-wallet-connector';
 * 
 * ReactDOM.createRoot(document.getElementById("root")!).render(
 *   <AoWalletProvider debug={import.meta.env.DEV}>
 *     <App />
 *   </AoWalletProvider>
 * );
 * 
 * // Component.tsx
 * import { useWallet, useAoSigner } from '@/lib/ao-wallet-connector';
 * 
 * function Component() {
 *   const { connected, address, connect, disconnect } = useWallet();
 *   const { signer } = useAoSigner(); // Already prepared!
 *   
 *   // Use signer directly with AO functions
 *   await spawnProcess("Name", undefined, undefined, signer);
 * }
 * ```
 */

// Provider
export { AoWalletProvider, default as AoWalletProviderDefault } from './provider';

// Hooks
export {
    useWallet,
    useAoSigner,
    useAddress,
    useWAuthData,
    useWalletType,
    useWalletModal,
} from './hooks';

// Types
export type {
    WalletStrategy,
    WalletConnectionState,
    AoSignerFunction,
    AoWalletProviderConfig,
    WalletContextValue,
    SignerContextValue,
    WAuthData,
} from './types';

// Strategies (for advanced usage)
export { ArweaveWalletStrategy } from './strategies/arweave';
export { MetaMaskWalletStrategy } from './strategies/metamask';
export { WAuthStrategy, WAuthProviders } from './strategies/wauth';

// Manager (for advanced usage)
export { walletManager, WalletManager } from './manager';

// Utilities
export { createAoSigner, isValidSigner } from './signer';
export { logger, setDebugMode, resetDebugMode } from './logger';

// Constants
export { STORAGE_KEYS, DEFAULT_PERMISSIONS, STRATEGY_IDS } from './constants';

// Legacy compatibility - these mirror the old wallet-strategies exports
export { fixConnection, shouldDisconnect } from './strategies/wauth';
