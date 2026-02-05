/**
 * AO Wallet Connector - Wallet Manager
 * 
 * Central manager for wallet strategies and connection state.
 * Handles lazy-loading of WAuth strategies and auto-reconnect.
 */

import type { WalletStrategy, WalletConnectionState } from './types';
import { WAuthStrategy } from './strategies/wauth';
import { ArweaveWalletStrategy } from './strategies/arweave';
import { MetaMaskWalletStrategy } from './strategies/metamask';
import { logger } from './logger';
import { STORAGE_KEYS, WAuthProviders } from './constants';

export class WalletManager {
    private strategies: Map<string, WalletStrategy> = new Map();
    private currentStrategy: WalletStrategy | null = null;
    private state: WalletConnectionState = {
        connected: false,
        address: null,
        publicKey: null,
        permissions: [],
        strategy: null,
    };
    private stateListeners: ((state: WalletConnectionState) => void)[] = [];

    constructor() {
        this.initializeStrategies();
        this.loadCachedStrategy();
    }

    private initializeStrategies(): void {
        // Initialize non-WAuth strategies immediately (they don't spam logs)
        const arweaveStrategy = new ArweaveWalletStrategy();
        this.strategies.set(arweaveStrategy.id, arweaveStrategy);

        const metamaskStrategy = new MetaMaskWalletStrategy();
        this.strategies.set(metamaskStrategy.id, metamaskStrategy);

        // WAuth strategies are lazy-loaded when needed
    }

    /**
     * Lazy-load a WAuth strategy when needed
     */
    private getOrCreateWAuthStrategy(provider: WAuthProviders): WalletStrategy {
        const strategyId = `wauth-${provider}`;

        if (!this.strategies.has(strategyId)) {
            logger.debug('Creating WAuth strategy:', provider);
            const strategy = new WAuthStrategy({ provider });
            this.strategies.set(strategyId, strategy);
        }

        return this.strategies.get(strategyId)!;
    }

    private loadCachedStrategy(): void {
        try {
            const cachedStrategyId = localStorage.getItem(STORAGE_KEYS.STRATEGY);
            if (cachedStrategyId) {
                if (cachedStrategyId.startsWith('wauth-')) {
                    const provider = cachedStrategyId.replace('wauth-', '') as WAuthProviders;
                    const strategy = this.getOrCreateWAuthStrategy(provider);
                    this.currentStrategy = strategy;
                    this.updateState({ strategy });
                } else {
                    const strategy = this.strategies.get(cachedStrategyId);
                    if (strategy) {
                        this.currentStrategy = strategy;
                        this.updateState({ strategy });
                    }
                }
                logger.debug('Loaded cached wallet strategy:', cachedStrategyId);
            }
        } catch (error) {
            logger.warn('Failed to load cached strategy:', error);
        }
    }

    private cacheStrategy(strategyId: string | null): void {
        try {
            if (strategyId) {
                localStorage.setItem(STORAGE_KEYS.STRATEGY, strategyId);
            } else {
                localStorage.removeItem(STORAGE_KEYS.STRATEGY);
            }
        } catch (error) {
            logger.warn('Failed to cache strategy:', error);
        }
    }

    private cacheAddress(address: string | null): void {
        try {
            if (address) {
                localStorage.setItem(STORAGE_KEYS.ADDRESS, address);
            } else {
                localStorage.removeItem(STORAGE_KEYS.ADDRESS);
            }
        } catch (error) {
            logger.warn('Failed to cache address:', error);
        }
    }

    public getCachedAddress(): string | null {
        try {
            return localStorage.getItem(STORAGE_KEYS.ADDRESS);
        } catch {
            return null;
        }
    }

    public getStrategies(): WalletStrategy[] {
        // Ensure all WAuth strategies are available (lazy-load them)
        const wauthProviders = [
            WAuthProviders.Github,
            WAuthProviders.Google,
            WAuthProviders.Discord,
            WAuthProviders.X,
        ];

        wauthProviders.forEach(provider => {
            this.getOrCreateWAuthStrategy(provider);
        });

        return Array.from(this.strategies.values());
    }

    public getCurrentStrategy(): WalletStrategy | null {
        return this.currentStrategy;
    }

    public setStrategy(strategyId: string): boolean {
        let strategy: WalletStrategy | undefined;

        if (strategyId.startsWith('wauth-')) {
            const provider = strategyId.replace('wauth-', '') as WAuthProviders;
            strategy = this.getOrCreateWAuthStrategy(provider);
        } else {
            strategy = this.strategies.get(strategyId);
        }

        if (strategy) {
            this.currentStrategy = strategy;
            this.updateState({ strategy });
            return true;
        }
        return false;
    }

    public getState(): WalletConnectionState {
        return { ...this.state };
    }

    public onStateChange(listener: (state: WalletConnectionState) => void): () => void {
        this.stateListeners.push(listener);
        return () => {
            const index = this.stateListeners.indexOf(listener);
            if (index > -1) {
                this.stateListeners.splice(index, 1);
            }
        };
    }

    private updateState(updates: Partial<WalletConnectionState>): void {
        this.state = { ...this.state, ...updates };
        this.stateListeners.forEach(listener => listener(this.state));
    }

    public async connect(permissions?: string[]): Promise<void> {
        if (!this.currentStrategy) {
            throw new Error('No wallet strategy selected');
        }

        logger.debug('Starting connection with strategy:', this.currentStrategy.id);

        try {
            await this.currentStrategy.connect(permissions);
            logger.debug('Strategy connect() completed');

            const address = await this.currentStrategy.getActiveAddress();
            logger.debug('Got address:', address);

            const publicKey = await this.currentStrategy.getActivePublicKey();
            logger.debug('Got public key:', publicKey);

            const walletPermissions = await this.currentStrategy.getPermissions();
            logger.debug('Got permissions:', walletPermissions);

            this.updateState({
                connected: true,
                address,
                publicKey,
                permissions: walletPermissions as string[],
                strategy: this.currentStrategy,
            });

            this.cacheStrategy(this.currentStrategy.id);
            this.cacheAddress(address);

            logger.debug('Connection complete!');
        } catch (error) {
            logger.error('Failed to connect wallet:', error);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (!this.currentStrategy) {
            return;
        }

        try {
            await this.currentStrategy.disconnect();
            this.currentStrategy = null;

            this.updateState({
                connected: false,
                address: null,
                publicKey: null,
                permissions: [],
                strategy: null,
            });

            this.cacheStrategy(null);
            this.cacheAddress(null);
        } catch (error) {
            logger.error('Failed to disconnect wallet:', error);
            throw error;
        }
    }

    public async getActiveAddress(): Promise<string | null> {
        if (!this.currentStrategy || !this.state.connected) {
            return null;
        }

        try {
            return await this.currentStrategy.getActiveAddress();
        } catch (error) {
            logger.error('Failed to get active address:', error);
            return null;
        }
    }

    public async getActivePublicKey(): Promise<string | null> {
        if (!this.currentStrategy || !this.state.connected) {
            return null;
        }

        try {
            return await this.currentStrategy.getActivePublicKey();
        } catch (error) {
            logger.error('Failed to get active public key:', error);
            return null;
        }
    }

    public async sign(transaction: unknown, options?: unknown): Promise<unknown> {
        if (!this.currentStrategy) {
            throw new Error('No wallet strategy selected');
        }
        return await this.currentStrategy.sign(transaction, options);
    }

    public async signDataItem(dataItem: unknown): Promise<ArrayBuffer> {
        if (!this.currentStrategy?.signDataItem) {
            throw new Error('Sign data item not supported by current strategy');
        }
        return await this.currentStrategy.signDataItem(dataItem);
    }

    public async signAns104(dataItem: unknown): Promise<{ id: string; raw: ArrayBuffer }> {
        if (!this.currentStrategy?.signAns104) {
            throw new Error('Sign ANS-104 not supported by current strategy');
        }
        return await this.currentStrategy.signAns104(dataItem);
    }

    // WAuth specific methods
    public getEmail(): { email: string; verified: boolean } | null {
        if (!this.currentStrategy?.getEmail) {
            return null;
        }
        try {
            return this.currentStrategy.getEmail();
        } catch {
            return null;
        }
    }

    public getUsername(): string | null {
        if (!this.currentStrategy?.getUsername) {
            return null;
        }
        try {
            return this.currentStrategy.getUsername();
        } catch {
            return null;
        }
    }

    public async addConnectedWallet(wallet: unknown): Promise<unknown> {
        if (!this.currentStrategy?.addConnectedWallet) {
            throw new Error('Add connected wallet not supported by current strategy');
        }
        return await this.currentStrategy.addConnectedWallet(wallet);
    }

    public async removeConnectedWallet(walletId: string): Promise<unknown> {
        if (!this.currentStrategy?.removeConnectedWallet) {
            throw new Error('Remove connected wallet not supported by current strategy');
        }
        return await this.currentStrategy.removeConnectedWallet(walletId);
    }

    public async getConnectedWallets(): Promise<unknown[]> {
        if (!this.currentStrategy?.getConnectedWallets) {
            return [];
        }
        try {
            return await this.currentStrategy.getConnectedWallets();
        } catch {
            return [];
        }
    }

    public getAuthData(): unknown {
        if (!this.currentStrategy?.getAuthData) {
            return null;
        }
        return this.currentStrategy.getAuthData();
    }

    public onAuthDataChange(callback: (data: unknown) => void): void {
        if (this.currentStrategy?.onAuthDataChange) {
            this.currentStrategy.onAuthDataChange(callback);
        }
    }

    public async reconnect(): Promise<unknown> {
        if (!this.currentStrategy?.reconnect) {
            return null;
        }
        return await this.currentStrategy.reconnect();
    }

    public getAoSigner(): unknown {
        if (!this.currentStrategy?.getAoSigner) {
            return null;
        }
        return this.currentStrategy.getAoSigner();
    }

    /**
     * Get the appropriate raw signer based on current wallet strategy
     * Returns different types depending on the wallet:
     * - Native Arweave: window.arweaveWallet (object)
     * - MetaMask/WAuth: AO signer function
     */
    public async getRawSigner(): Promise<unknown> {
        if (!this.currentStrategy) {
            return null;
        }

        if (this.currentStrategy.id === 'arweave-native') {
            return typeof window !== 'undefined' ? window.arweaveWallet : null;
        }

        return this.getAoSigner();
    }

    // Wallet type checks
    public isWAuthStrategy(): boolean {
        return this.currentStrategy?.id.startsWith('wauth-') || false;
    }

    public isEthereumWallet(): boolean {
        return (
            this.currentStrategy?.id === 'metamask' ||
            this.currentStrategy?.description?.toLowerCase().includes('ethereum') ||
            false
        );
    }

    public isArweaveNativeStrategy(): boolean {
        return this.currentStrategy?.id === 'arweave-native';
    }

    public isMetaMaskStrategy(): boolean {
        return this.currentStrategy?.id === 'metamask';
    }

    /**
     * Auto-reconnect to the cached wallet strategy
     */
    public async autoReconnect(): Promise<boolean> {
        const cachedStrategyId = localStorage.getItem(STORAGE_KEYS.STRATEGY);
        const cachedAddress = this.getCachedAddress();

        if (!cachedStrategyId || !cachedAddress) {
            logger.debug('No cached wallet found');
            return false;
        }

        try {
            logger.debug('Attempting to reconnect to:', cachedStrategyId);

            const success = this.setStrategy(cachedStrategyId);
            if (!success) {
                throw new Error('Failed to set cached strategy');
            }

            // For WAuth strategies, they auto-reconnect during initialization
            if (cachedStrategyId.startsWith('wauth-')) {
                logger.debug('WAuth strategy detected - waiting for auto-reconnection...');

                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const address = await this.currentStrategy?.getActiveAddress();
                    if (address) {
                        logger.debug('WAuth auto-reconnect detected, syncing state');

                        const publicKey = await this.currentStrategy?.getActivePublicKey();
                        const permissions = await this.currentStrategy?.getPermissions();

                        this.updateState({
                            connected: true,
                            address,
                            publicKey,
                            permissions: (permissions || []) as string[],
                            strategy: this.currentStrategy,
                        });

                        logger.debug('WAuth auto-reconnect successful');
                        return true;
                    }
                } catch {
                    logger.debug('WAuth auto-reconnect not completed');
                }
            }

            // Try to reconnect
            if (this.currentStrategy?.reconnect) {
                await this.currentStrategy.reconnect();
            } else {
                await this.connect();
            }

            logger.debug('Auto-reconnect successful');
            return true;
        } catch (error) {
            logger.warn('Auto-reconnect failed:', error);
            return false;
        }
    }
}

// Global wallet manager instance
export const walletManager = new WalletManager();
