/**
 * AO Wallet Connector Constants
 */

// localStorage keys
export const STORAGE_KEYS = {
    STRATEGY: 'ao_wallet_strategy',
    ADDRESS: 'ao_wallet_address',
    DEBUG: 'AO_WALLET_DEBUG',
    WAUTH_EMAIL: 'ao_wauth_email',
    WAUTH_USERNAME: 'ao_wauth_username',
    WAUTH_ADDRESS: 'ao_wauth_address',
} as const;

// Default permissions for wallet connections
export const DEFAULT_PERMISSIONS = [
    'ACCESS_ADDRESS',
    'ACCESS_PUBLIC_KEY',
    'SIGN_TRANSACTION',
    'DISPATCH',
] as const;

// WAuth provider options - must match @wauth/sdk values
export enum WAuthProviders {
    Github = 'github',
    Google = 'google',
    Discord = 'discord',
    X = 'twitter', // SDK uses 'twitter' internally
}

// Strategy IDs
export const STRATEGY_IDS = {
    ARWEAVE_NATIVE: 'arweave-native',
    METAMASK: 'metamask',
    WAUTH_GITHUB: 'wauth-github',
    WAUTH_GOOGLE: 'wauth-google',
    WAUTH_DISCORD: 'wauth-discord',
    WAUTH_X: 'wauth-x',
} as const;
