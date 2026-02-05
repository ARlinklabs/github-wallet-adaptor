/**
 * AO Wallet Connector - WAuth Strategy
 * 
 * OAuth-based wallet strategy supporting GitHub, Google, Discord, and X.
 */

import type { WalletStrategy, AoSignerFunction } from '../types';
import { WAuth } from '@wauth/sdk';
import { logger } from '../logger';
import { WAuthProviders } from '../constants';
import type Transaction from 'arweave/web/lib/transaction';

export { WAuthProviders };

const WAUTH_LOGOS: Record<WAuthProviders, string> = {
    [WAuthProviders.Google]: 'mc-lqDefUJZdDSOOqepLICrfEoQCACnS51tB3kKqvlk',
    [WAuthProviders.Github]: '2bcLcWjuuRFDqFHlUvgvX2MzA2hOlZL1ED-T8OFBwCY',
    [WAuthProviders.Discord]: 'i4Lw4kXr5t57p8E1oOVGMO4vR35TlYsaJ9XYbMMVd8I',
    [WAuthProviders.X]: 'WEcpgXgwGO1PwuIAucwXHUiJ5HWHwkaYTUaAN4wlqQA',
};

export class WAuthStrategy implements WalletStrategy {
    public id: string;
    public name: string;
    public description: string;
    public theme: string;
    public logo: string;
    public url: string;

    private walletRef: WAuth;
    private provider: WAuthProviders;
    private addressListeners: ((address: string) => void)[] = [];
    private scopes: string[];
    private authData: unknown;
    private authDataListeners: ((data: unknown) => void)[] = [];

    constructor({ provider, scopes = [] }: { provider: WAuthProviders; scopes?: string[] }) {
        this.provider = provider;
        this.scopes = scopes;
        this.id = 'wauth-' + this.provider;
        this.name = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
        this.description = 'WAuth';
        this.theme = '25,25,25';
        this.url = 'https://subspace.ar.io';

        // WAuth auto-reconnects based on localStorage
        // dev: false uses production URLs
        this.walletRef = new WAuth({ dev: false });
        this.authData = this.walletRef.getAuthData();
        this.logo = WAUTH_LOGOS[provider];
    }

    public async connect(permissions?: string[]): Promise<void> {
        if (permissions) {
            logger.warn('WAuth does not support custom permissions');
        }

        const data = await this.walletRef.connect({ provider: this.provider, scopes: this.scopes });
        if (data) {
            this.authData = data?.meta;
            this.authDataListeners.forEach(listener => listener(data?.meta));
        }
    }

    public async reconnect(): Promise<unknown> {
        // Check if already connected from auto-reconnect
        try {
            const existingAuthData = this.walletRef.getAuthData();
            if (existingAuthData) {
                logger.debug('WAuth already auto-reconnected, using existing session');
                this.authData = existingAuthData;
                this.authDataListeners.forEach(listener => listener(existingAuthData));
                return existingAuthData;
            }
        } catch {
            logger.debug('No existing WAuth session, connecting manually');
        }

        // If not already connected, try to connect
        const data = await this.walletRef.connect({ provider: this.provider, scopes: this.scopes });
        if (data) {
            this.authData = data?.meta;
            this.authDataListeners.forEach(listener => listener(this.authData));
        }
        return this.authData;
    }

    public onAuthDataChange(callback: (data: unknown) => void): void {
        this.authDataListeners.push(callback);
    }

    public getAuthData(): unknown {
        return this.walletRef.getAuthData();
    }

    public async addConnectedWallet(ArweaveWallet: {
        getActiveAddress: () => Promise<string>;
        getActivePublicKey: () => Promise<string>;
        connect: (permissions: string[]) => Promise<void>;
        signMessage: (data: Uint8Array) => Promise<Uint8Array>;
    }): Promise<unknown> {
        const address = await ArweaveWallet.getActiveAddress();
        const pkey = await ArweaveWallet.getActivePublicKey();
        if (!address) throw new Error('No address found');
        if (!pkey) throw new Error('No public key found');

        // Connect with SIGNATURE permission if not already connected
        await ArweaveWallet.connect(['SIGNATURE']);

        // Create message data and encode it
        const data = new TextEncoder().encode(JSON.stringify({ address, pkey }));

        // Sign the message
        const signature = await ArweaveWallet.signMessage(data);
        const signatureString = Buffer.from(signature).toString('base64');

        const resData = await this.walletRef.addConnectedWallet(address, pkey, signatureString);
        return resData;
    }

    public async removeConnectedWallet(walletId: string): Promise<unknown> {
        const resData = await this.walletRef.removeConnectedWallet(walletId);
        return resData;
    }

    public async disconnect(): Promise<void> {
        this.walletRef.logout();
        this.authData = null;
    }

    public async getActiveAddress(): Promise<string> {
        return await this.walletRef.getActiveAddress();
    }

    public async getAllAddresses(): Promise<string[]> {
        return [await this.getActiveAddress()];
    }

    public async getActivePublicKey(): Promise<string> {
        return await this.walletRef.getActivePublicKey();
    }

    public async getConnectedWallets(): Promise<unknown[]> {
        return await this.walletRef.getConnectedWallets();
    }

    public async sign(transaction: unknown, options?: unknown): Promise<unknown> {
        return await this.walletRef.sign(transaction as never, options as never);
    }

    public async getPermissions(): Promise<string[]> {
        return await this.walletRef.getPermissions();
    }

    public async getWalletNames(): Promise<Record<string, string>> {
        return await this.walletRef.getWalletNames();
    }

    public encrypt(): Promise<Uint8Array> {
        throw new Error('Encrypt is not implemented in WAuth yet');
    }

    public decrypt(): Promise<Uint8Array> {
        throw new Error('Decrypt is not implemented in WAuth yet');
    }

    public async getArweaveConfig(): Promise<unknown> {
        return await this.walletRef.getArweaveConfig();
    }

    public async isAvailable(): Promise<boolean> {
        return true;
    }

    public async dispatch(): Promise<unknown> {
        throw new Error('Dispatch is not implemented in WAuth yet');
    }

    public async signDataItem(dataItem: unknown): Promise<ArrayBuffer> {
        return await this.walletRef.signDataItem(dataItem as never);
    }

    public async signature(
        data: Uint8Array,
        algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams
    ): Promise<Uint8Array> {
        return await this.walletRef.signature(data, algorithm);
    }

    public async signAns104(dataItem: unknown): Promise<{ id: string; raw: ArrayBuffer }> {
        return await this.walletRef.signAns104(dataItem as never);
    }

    public addAddressEvent(
        listener: (address: string) => void
    ): ((e: CustomEvent<{ address: string }>) => void) {
        this.addressListeners.push(listener);
        return listener as never;
    }

    public removeAddressEvent(listener: (e: CustomEvent<{ address: string }>) => void): void {
        this.addressListeners.splice(this.addressListeners.indexOf(listener as never), 1);
    }

    public getAoSigner(): AoSignerFunction {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return async (create: any) => {
            const { data, tags, target, anchor } = await create({ alg: 'rsa-v1_5-sha256', passthrough: true });
            const signedDataItem = await this.signAns104({ data, tags, target, anchor });

            return {
                id: signedDataItem.id,
                raw: Buffer.from(signedDataItem.raw),
            };
        };
    }

    public getEmail(): { email: string; verified: boolean } {
        return this.walletRef.getEmail();
    }

    public getUsername(): string | null {
        try {
            // First try to get username from wauth SDK
            const username = this.walletRef.getUsername();
            if (username) return username;

            // If not available, try to extract from auth data
            const authData = this.walletRef.getAuthData() as Record<string, unknown> | null;

            if (this.provider === WAuthProviders.Github && authData) {
                // Check various possible locations
                if (authData.username) return authData.username as string;
                if (authData.login) return authData.login as string;

                const user = authData.user as Record<string, unknown> | undefined;
                if (user?.login) return user.login as string;
                if (user?.username) return user.username as string;

                const profile = authData.profile as Record<string, unknown> | undefined;
                if (profile?.login) return profile.login as string;
                if (profile?.username) return profile.username as string;
            }

            return null;
        } catch (error) {
            logger.error('Error getting username:', error);
            return null;
        }
    }
}

/**
 * Helper: Check if wallet should be disconnected
 */
export function shouldDisconnect(address: string | undefined, connected: boolean): boolean {
    if (connected && !address && !localStorage.getItem('pocketbase_auth')) {
        return true;
    }
    return false;
}

/**
 * Helper: Fix connection edge cases
 */
export function fixConnection(
    address: string | undefined,
    connected: boolean,
    disconnect: () => void
): void {
    if (shouldDisconnect(address, connected)) {
        localStorage.removeItem('pocketbase_auth');
        localStorage.removeItem('wallet_kit_strategy_id');
        disconnect();
    }
}
