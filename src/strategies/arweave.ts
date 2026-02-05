// @ts-nocheck
/**
 * AO Wallet Connector - Arweave Native Strategy
 * 
 * Strategy for native Arweave wallets like Wander.
 */

import type { WalletStrategy } from '../types';
import { logger } from '../logger';
import { DataItem } from '@dha-team/arbundles';
import type Transaction from 'arweave/web/lib/transaction';

declare global {
    interface Window {
        arweaveWallet: {
            connect(permissions: string[], options?: { name?: string }): Promise<void>;
            disconnect(): Promise<void>;
            getActiveAddress(): Promise<string>;
            getAllAddresses?(): Promise<string[]>;
            getActivePublicKey(): Promise<string>;
            getPermissions?(): Promise<string[]>;
            getWalletNames?(): Promise<Record<string, string>>;
            sign(transaction: Transaction, options?: unknown): Promise<Transaction>;
            encrypt?(data: BufferSource, options: unknown): Promise<Uint8Array>;
            decrypt?(data: BufferSource, options: unknown): Promise<Uint8Array>;
            getArweaveConfig?(): Promise<unknown>;
            dispatch?(transaction: Transaction): Promise<unknown>;
            signDataItem?(dataItem: DataItem): Promise<ArrayBuffer>;
            signature?(data: Uint8Array, algorithm: unknown): Promise<Uint8Array>;
            signAns104?(dataItem: DataItem): Promise<{ id: string; raw: ArrayBuffer }>;
            walletName?: string;
        };
    }
}

export class ArweaveWalletStrategy implements WalletStrategy {
    public id = 'arweave-native';
    public name = 'Wander';
    public description = 'Native Arweave Wallet (Wander, etc.)';
    public theme = '0,0,0';
    public logo = '/logos/wander.png';
    public url = 'https://wander.app';

    private addressListeners: ((address: string) => void)[] = [];
    private isConnected = false;
    private currentAddress: string | null = null;
    private permissions: string[] = [
        'ACCESS_ADDRESS',
        'ACCESS_ALL_ADDRESSES',
        'ACCESS_ARWEAVE_CONFIG',
        'ACCESS_PUBLIC_KEY',
        'DECRYPT',
        'ENCRYPT',
        'DISPATCH',
        'SIGNATURE',
        'SIGN_TRANSACTION',
    ];

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (typeof window !== 'undefined' && window.arweaveWallet) {
            try {
                window.addEventListener('arweaveWalletLoaded', () => {
                    logger.debug('Arweave wallet loaded');
                });

                window.addEventListener('walletSwitch', (e: CustomEvent<{ address: string }>) => {
                    logger.debug('Wallet switched:', e.detail.address);
                    this.currentAddress = e.detail.address;
                    this.addressListeners.forEach(listener => listener(e.detail.address));
                });
            } catch (error) {
                logger.warn('Could not setup Arweave wallet event listeners:', error);
            }
        }
    }

    public async isAvailable(): Promise<boolean> {
        return typeof window !== 'undefined' && !!window.arweaveWallet;
    }

    public async connect(permissions?: string[]): Promise<void> {
        const perms = permissions || this.permissions;

        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not found. Please install Wander or another Arweave wallet extension.');
        }

        try {
            await window.arweaveWallet.connect(perms, { name: 'Arlink' });
            this.currentAddress = await window.arweaveWallet.getActiveAddress();
            this.isConnected = true;
            logger.debug('Connected to Arweave wallet:', this.currentAddress);
        } catch (error) {
            logger.error('Failed to connect to Arweave wallet:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            if (window.arweaveWallet?.disconnect) {
                await window.arweaveWallet.disconnect();
            }
            this.isConnected = false;
            this.currentAddress = null;
            logger.debug('Disconnected from Arweave wallet');
        } catch (error) {
            logger.error('Error disconnecting Arweave wallet:', error);
            throw error;
        }
    }

    public async getActiveAddress(): Promise<string> {
        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not available');
        }

        try {
            const address = await window.arweaveWallet.getActiveAddress();
            this.currentAddress = address;
            return address;
        } catch (error) {
            logger.error('Failed to get active address:', error);
            throw error;
        }
    }

    public async getAllAddresses(): Promise<string[]> {
        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not available');
        }

        try {
            if (window.arweaveWallet.getAllAddresses) {
                return await window.arweaveWallet.getAllAddresses();
            }
            const activeAddress = await this.getActiveAddress();
            return [activeAddress];
        } catch (error) {
            logger.error('Failed to get all addresses:', error);
            return [];
        }
    }

    public async getActivePublicKey(): Promise<string> {
        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not available');
        }

        try {
            return await window.arweaveWallet.getActivePublicKey();
        } catch (error) {
            logger.error('Failed to get active public key:', error);
            throw error;
        }
    }

    public async sign(transaction: Transaction, options?: unknown): Promise<Transaction> {
        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not available');
        }

        try {
            return await window.arweaveWallet.sign(transaction, options);
        } catch (error) {
            logger.error('Failed to sign transaction:', error);
            throw error;
        }
    }

    public async getPermissions(): Promise<string[]> {
        if (!window.arweaveWallet) {
            return [];
        }

        try {
            if (window.arweaveWallet.getPermissions) {
                return await window.arweaveWallet.getPermissions();
            }
            return this.permissions;
        } catch (error) {
            logger.error('Failed to get permissions:', error);
            return [];
        }
    }

    public async getWalletNames(): Promise<Record<string, string>> {
        if (window.arweaveWallet?.getWalletNames) {
            try {
                return await window.arweaveWallet.getWalletNames();
            } catch (error) {
                logger.error('Failed to get wallet names:', error);
            }
        }
        return {};
    }

    public async encrypt(data: BufferSource, options: unknown): Promise<Uint8Array> {
        if (!window.arweaveWallet?.encrypt) {
            throw new Error('Encrypt not supported');
        }
        return await window.arweaveWallet.encrypt(data, options);
    }

    public async decrypt(data: BufferSource, options: unknown): Promise<Uint8Array> {
        if (!window.arweaveWallet?.decrypt) {
            throw new Error('Decrypt not supported');
        }
        return await window.arweaveWallet.decrypt(data, options);
    }

    public async getArweaveConfig(): Promise<unknown> {
        if (!window.arweaveWallet?.getArweaveConfig) {
            return null;
        }
        try {
            return await window.arweaveWallet.getArweaveConfig();
        } catch (error) {
            logger.error('Failed to get Arweave config:', error);
            return null;
        }
    }

    public async dispatch(transaction: Transaction): Promise<unknown> {
        if (!window.arweaveWallet?.dispatch) {
            throw new Error('Dispatch not supported');
        }
        return await window.arweaveWallet.dispatch(transaction);
    }

    public async signDataItem(dataItem: unknown): Promise<ArrayBuffer> {
        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not available');
        }

        try {
            return await window.arweaveWallet.signDataItem(dataItem as DataItem);
        } catch (error) {
            logger.error('Failed to sign data item:', error);
            throw error;
        }
    }

    public async signature(data: Uint8Array, algorithm: unknown): Promise<Uint8Array> {
        if (!window.arweaveWallet?.signature) {
            throw new Error('Signature method not supported');
        }
        return await window.arweaveWallet.signature(data, algorithm);
    }

    public async signAns104(dataItem: unknown): Promise<{ id: string; raw: ArrayBuffer }> {
        if (!window.arweaveWallet) {
            throw new Error('Arweave wallet not available');
        }

        try {
            return await window.arweaveWallet.signAns104(dataItem as DataItem);
        } catch (error) {
            logger.error('Failed to sign ANS-104:', error);
            throw error;
        }
    }

    public addAddressEvent(listener: (address: string) => void): unknown {
        this.addressListeners.push(listener);
        return listener;
    }

    public removeAddressEvent(listener: unknown): void {
        const index = this.addressListeners.indexOf(listener as (address: string) => void);
        if (index > -1) {
            this.addressListeners.splice(index, 1);
        }
    }
}
