/**
 * AO Wallet Connector - React Context
 * 
 * Internal context for sharing wallet state across components.
 */

import { createContext } from 'react';
import type { WalletContextValue, SignerContextValue, WAuthData } from './types';

/**
 * Main wallet context - provides connection state and actions
 */
export const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Signer context - provides the ready-to-use AO signer
 */
export const SignerContext = createContext<SignerContextValue | null>(null);

/**
 * WAuth context - provides OAuth-specific data (email, username)
 */
export const WAuthContext = createContext<WAuthData | null>(null);
