/**
 * AO Wallet Connector - Auto-Preparing Signer
 * 
 * This module provides signer utilities that automatically prepare signers
 * for AO operations. Users don't need to call prepareAoSigner manually.
 */

import { createDataItemSigner } from '@permaweb/aoconnect';
import { logger } from './logger';
import type { AoSignerFunction } from './types';

/**
 * Creates an AO-compatible signer from a raw signer.
 * This handles the conversion logic so users don't need to call prepareAoSigner.
 * 
 * - If signer is a function (WAuth/MetaMask AO signer), use it directly
 * - If signer is an object (window.arweaveWallet), wrap with createDataItemSigner
 * - Returns null for invalid/null signers
 */
export function createAoSigner(rawSigner: unknown): AoSignerFunction | null {
    logger.debug('createAoSigner input:', {
        type: typeof rawSigner,
        isNull: rawSigner === null,
        isUndefined: rawSigner === undefined,
        isFunction: typeof rawSigner === 'function',
        isObject: typeof rawSigner === 'object',
    });

    // Return null for null, undefined, or invalid signers
    if (!rawSigner) {
        logger.debug('Signer is null/undefined, returning null');
        return null;
    }

    // If it's already a function (AO signer from WAuth or MetaMask), use it directly
    if (typeof rawSigner === 'function') {
        logger.debug('Signer is a function (WAuth/MetaMask), using directly');
        return rawSigner as AoSignerFunction;
    }

    // If it's an object (window.arweaveWallet), wrap it with createDataItemSigner
    if (typeof rawSigner === 'object' && rawSigner !== null) {
        try {
            logger.debug('Signer is an object (Arweave wallet), wrapping with createDataItemSigner');
            // createDataItemSigner returns a function compatible with AO
            const wrapped = createDataItemSigner(rawSigner) as AoSignerFunction;
            logger.debug('Successfully wrapped signer');
            return wrapped;
        } catch (error) {
            logger.error('Failed to create data item signer:', error);
            return null;
        }
    }

    // For any other unexpected types, return null
    logger.warn('Invalid signer type:', typeof rawSigner);
    return null;
}

/**
 * Check if a signer is valid and ready to use
 */
export function isValidSigner(signer: unknown): signer is AoSignerFunction {
    return typeof signer === 'function';
}
