/**
 * AO Wallet Connector Types
 */

import type Transaction from 'arweave/web/lib/transaction';

/**
 * Wallet strategy interface - defines the contract all wallet strategies must implement
 */
export interface WalletStrategy {
    id: string;
    name: string;
    description: string;
    theme: string;
    logo: string;
    url: string;

    // Core wallet methods
    connect(permissions?: string[]): Promise<void>;
    disconnect(): Promise<void>;
    getActiveAddress(): Promise<string>;
    getAllAddresses(): Promise<string[]>;
    getActivePublicKey(): Promise<string>;
    sign(transaction: unknown, options?: unknown): Promise<unknown>;
    getPermissions(): Promise<unknown[]>;
    getWalletNames(): Promise<Record<string, string>>;
    isAvailable(): Promise<boolean>;

    // Optional methods
    encrypt?(data: BufferSource, options: unknown): Promise<Uint8Array>;
    decrypt?(data: BufferSource, options: unknown): Promise<Uint8Array>;
    getArweaveConfig?(): Promise<unknown>;
    dispatch?(transaction: Transaction): Promise<unknown>;
    signDataItem?(dataItem: unknown): Promise<ArrayBuffer>;
    signature?(data: Uint8Array, algorithm: unknown): Promise<Uint8Array>;
    signAns104?(dataItem: unknown): Promise<{ id: string; raw: ArrayBuffer }>;

    // Event handling
    addAddressEvent?(listener: (address: string) => void): unknown;
    removeAddressEvent?(listener: unknown): void;

    // WAuth specific methods
    getEmail?(): { email: string; verified: boolean };
    getUsername?(): string | null;
    addConnectedWallet?(wallet: unknown): Promise<unknown>;
    removeConnectedWallet?(walletId: string): Promise<unknown>;
    getConnectedWallets?(): Promise<unknown[]>;
    getAuthData?(): unknown;
    onAuthDataChange?(callback: (data: unknown) => void): void;
    reconnect?(): Promise<unknown>;
    getAoSigner?(): AoSignerFunction;
}

/**
 * AO signer function type - the function signature expected by @permaweb/aoconnect
 * This is intentionally loose to support different wallet implementations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AoSignerFunction = (...args: any[]) => Promise<any>;

/**
 * Wallet connection state
 */
export interface WalletConnectionState {
    connected: boolean;
    address: string | null;
    publicKey: string | null;
    permissions: string[];
    strategy: WalletStrategy | null;
}

/**
 * Provider configuration
 */
export interface AoWalletProviderConfig {
    /** Enable debug logging */
    debug?: boolean;
    /** Default permissions to request on connect */
    permissions?: string[];
    /** Theme settings */
    theme?: {
        displayTheme?: 'light' | 'dark';
    };
    /** Auto-reconnect on mount (default: true) */
    autoConnect?: boolean;
}

/**
 * Wallet context value - what useWallet() returns
 */
export interface WalletContextValue {
    // Connection state
    connected: boolean;
    address: string | null;
    publicKey: string | null;

    // Actions
    connect: (strategyId?: string) => Promise<void>;
    disconnect: () => Promise<void>;

    // Strategy info
    strategy: WalletStrategy | null;
    strategies: WalletStrategy[];
    setStrategy: (strategyId: string) => boolean;

    // Loading/error state
    isLoading: boolean;
    error: string | null;

    // Wallet type checks
    isWAuth: boolean;
    isArweaveNative: boolean;
    isMetaMask: boolean;
}

/**
 * Signer context value - what useAoSigner() returns
 */
export interface SignerContextValue {
    /** Ready-to-use AO signer (already prepared) */
    signer: AoSignerFunction | null;
    /** Loading state while signer is being initialized */
    isLoading: boolean;
}

/**
 * WAuth data for OAuth-based wallets
 */
export interface WAuthData {
    email: { email: string; verified: boolean } | null;
    username: string | null;
}
