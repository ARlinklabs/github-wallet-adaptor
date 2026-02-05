/**
 * AO Wallet Connector - Debug Logger
 * 
 * Only logs when debug mode is enabled via:
 * 1. localStorage.setItem('AO_WALLET_DEBUG', 'true')
 * 2. <AoWalletProvider debug={true}>
 * 3. VITE_WALLET_DEBUG=true environment variable
 */

import { STORAGE_KEYS } from './constants';

let debugEnabled: boolean | null = null;
let providerDebugOverride: boolean | null = null;

/**
 * Check if debug mode is enabled
 */
function isDebugEnabled(): boolean {
    // Provider override takes precedence
    if (providerDebugOverride !== null) {
        return providerDebugOverride;
    }

    // Cache the check for performance
    if (debugEnabled === null) {
        try {
            // Check localStorage
            const localStorageDebug = localStorage.getItem(STORAGE_KEYS.DEBUG) === 'true';
            // Check environment variable (Vite)
            const envDebug = typeof import.meta !== 'undefined' &&
                import.meta.env?.VITE_WALLET_DEBUG === 'true';

            debugEnabled = localStorageDebug || envDebug;
        } catch {
            debugEnabled = false;
        }
    }

    return debugEnabled;
}

/**
 * Set debug mode from provider
 */
export function setDebugMode(enabled: boolean): void {
    providerDebugOverride = enabled;
}

/**
 * Reset debug mode (for testing)
 */
export function resetDebugMode(): void {
    debugEnabled = null;
    providerDebugOverride = null;
}

/**
 * Logger object with conditional logging methods
 */
export const logger = {
    /**
     * Debug log - only shows when debug mode is enabled
     */
    debug: (...args: unknown[]): void => {
        if (isDebugEnabled()) {
            console.log('[ao-wallet]', ...args);
        }
    },

    /**
     * Info log - only shows when debug mode is enabled
     */
    info: (...args: unknown[]): void => {
        if (isDebugEnabled()) {
            console.info('[ao-wallet]', ...args);
        }
    },

    /**
     * Warning log - only shows when debug mode is enabled
     */
    warn: (...args: unknown[]): void => {
        if (isDebugEnabled()) {
            console.warn('[ao-wallet]', ...args);
        }
    },

    /**
     * Error log - always shows (errors should never be hidden)
     */
    error: (...args: unknown[]): void => {
        console.error('[ao-wallet]', ...args);
    },
};

export default logger;
