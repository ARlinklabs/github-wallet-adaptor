/**
 * AO Wallet Connector - Arlink Auth Strategy
 *
 * OAuth-based wallet strategy supporting GitHub and Google via arlinkauth.
 */

import type { WalletStrategy, AoSignerFunction } from '../types';
import { createWauthClient, type LoginResult } from 'arlinkauth';
import { logger } from '../logger';
import { WAuthProviders } from '../constants';

export { WAuthProviders };

const WAUTH_LOGOS: Record<WAuthProviders, string> = {
    [WAuthProviders.Google]: 'mc-lqDefUJZdDSOOqepLICrfEoQCACnS51tB3kKqvlk',
    [WAuthProviders.Github]: '2bcLcWjuuRFDqFHlUvgvX2MzA2hOlZL1ED-T8OFBwCY',
};

export class WAuthStrategy implements WalletStrategy {
    public id: string;
    public name: string;
    public description: string;
    public theme: string;
    public logo: string;
    public url: string;

    private client: ReturnType<typeof createWauthClient>;
    private provider: WAuthProviders;
    private addressListeners: ((address: string) => void)[] = [];
    private scopes: string[];
    private authDataListeners: ((data: unknown) => void)[] = [];
    private initialized: boolean = false;

    constructor({ provider, scopes = [], apiUrl }: { provider: WAuthProviders; scopes?: string[]; apiUrl?: string }) {
        this.provider = provider;
        this.scopes = scopes;
        this.id = 'wauth-' + this.provider;
        this.name = provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase();
        this.description = 'Arlink Auth';
        this.theme = '25,25,25';
        this.url = 'https://arlink.io';

        this.client = createWauthClient({
            apiUrl: apiUrl || 'https://arlinkauth.contact-arlink.workers.dev',
        });
        this.logo = WAUTH_LOGOS[provider];
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.client.init();
            this.initialized = true;
        }
    }

    /**
     * Get the arweave_address from current state, or empty string.
     */
    private getAddressFromState(): string {
        try {
            const state = this.client.getState() as Record<string, unknown>;
            const user = state.user as Record<string, unknown> | null;
            return (user?.arweave_address as string) || '';
        } catch {
            return '';
        }
    }

    /**
     * Listen for the SDK's onAuthChange to deliver user data with arweave_address.
     * Returns a cleanup function and a promise that resolves when data arrives.
     *
     * This handles the race condition in the SDK where loginWithGithub() resolves
     * with { success: false } because the popup-close detector beats the async
     * getMe() call, even though the token IS stored and getMe() IS running in
     * the background. We listen for the state update that getMe() will produce.
     */
    private listenForUserData(): { promise: Promise<boolean>; cancel: () => void } {
        // Already have user data?
        if (this.getAddressFromState()) {
            return { promise: Promise.resolve(true), cancel: () => {} };
        }

        let settled = false;
        let unsub: () => void = () => {};
        let timer: ReturnType<typeof setTimeout>;

        const promise = new Promise<boolean>((resolve) => {
            const done = (success: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                unsub();
                resolve(success);
            };

            // Safety timeout — the onAuthChange should fire well before this.
            // This only triggers if getMe() genuinely fails/hangs.
            timer = setTimeout(() => {
                logger.warn('Arlink Auth: safety timeout waiting for user data');
                done(false);
            }, 30000);

            // Event-driven: fires as soon as getMe() completes in the background
            unsub = this.client.onAuthChange((authState: unknown) => {
                const s = authState as { user?: { arweave_address?: string } };
                if (s?.user?.arweave_address) {
                    logger.debug('Arlink Auth: onAuthChange delivered user data');
                    done(true);
                }
            });
        });

        const cancel = () => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                unsub();
            }
        };

        return { promise, cancel };
    }

    public async connect(permissions?: string[]): Promise<void> {
        if (permissions) {
            logger.warn('Arlink Auth does not support custom permissions');
        }

        await this.ensureInitialized();

        const scopeOptions = this.scopes.length > 0 ? { scopes: this.scopes } : undefined;

        // Set up onAuthChange listener BEFORE login so we catch the state
        // update from the background getMe() even if loginWithGithub()
        // resolves early with { success: false } due to the popup-close race.
        const { promise: userDataReady, cancel: cancelListener } = this.listenForUserData();

        let loginResult: LoginResult | undefined;
        if (this.provider === WAuthProviders.Github) {
            loginResult = await this.client.loginWithGithub(scopeOptions);
        } else if (this.provider === WAuthProviders.Google) {
            loginResult = await this.client.loginWithGoogle(scopeOptions);
        }

        if (loginResult?.success) {
            // Happy path: SDK's getMe() completed before popup-close detection.
            // State already has full user data — clean up listener.
            cancelListener();
            logger.debug('Arlink Auth: login succeeded, address:', this.getAddressFromState());
        } else {
            // The popup-close detector won the race against getMe().
            // But the token IS in localStorage and getMe() IS still running.
            logger.debug('Arlink Auth: login returned success=false, checking token...');

            const state = this.client.getState();
            if (state.token || state.isAuthenticated) {
                // Token exists — getMe() is running in the background.
                // Wait for onAuthChange to deliver user data (event-driven, no polling).
                logger.debug('Arlink Auth: token present, waiting for background getMe()...');
                const ready = await userDataReady;
                if (!ready) {
                    // getMe() may have failed. Try init() as last resort.
                    logger.debug('Arlink Auth: retrying with init()...');
                    await this.client.init();
                }
            } else {
                // No token — user closed popup without authenticating.
                cancelListener();
                throw new Error('Login was cancelled');
            }
        }

        logger.debug('Arlink Auth: connect complete, address:', this.getAddressFromState());

        const finalState = this.client.getState();
        if (finalState.user) {
            this.authDataListeners.forEach(listener => listener(finalState.user));
        }
    }

    public async reconnect(): Promise<unknown> {
        // init() reads token from localStorage and calls getMe() to fetch user.
        // This is the proper way to restore a session.
        const authState = await this.client.init();
        this.initialized = true;

        if (authState.isAuthenticated && authState.user) {
            logger.debug('Arlink Auth session restored, address:', (authState.user as Record<string, unknown>).arweave_address);
            this.authDataListeners.forEach(listener => listener(authState.user));
            return authState.user;
        }

        return null;
    }

    public onAuthDataChange(callback: (data: unknown) => void): void {
        this.authDataListeners.push(callback);
        this.client.onAuthChange((state: unknown) => {
            const authState = state as { user?: unknown };
            callback(authState?.user);
        });
    }

    public getAuthData(): unknown {
        return this.client.getState().user;
    }

    public async addConnectedWallet(): Promise<unknown> {
        throw new Error('addConnectedWallet is not supported by Arlink Auth');
    }

    public async removeConnectedWallet(): Promise<unknown> {
        throw new Error('removeConnectedWallet is not supported by Arlink Auth');
    }

    public async disconnect(): Promise<void> {
        await this.client.logout();
        this.initialized = false;
    }

    public async getActiveAddress(): Promise<string> {
        await this.ensureInitialized();

        let address = this.getAddressFromState();
        if (!address) {
            // Force re-init in case state is stale
            try { await this.client.init(); } catch { /* ignore */ }
            address = this.getAddressFromState();
        }

        return address;
    }

    public async getAllAddresses(): Promise<string[]> {
        return [await this.getActiveAddress()];
    }

    public async getActivePublicKey(): Promise<string> {
        // arlinkauth handles signing server-side; public key not exposed client-side
        return '';
    }

    public async getConnectedWallets(): Promise<unknown[]> {
        return [];
    }

    public async sign(transaction: unknown): Promise<unknown> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await this.client.sign(transaction as any);
    }

    public async getPermissions(): Promise<string[]> {
        return ['ACCESS_ADDRESS', 'SIGN_TRANSACTION'];
    }

    public async getWalletNames(): Promise<Record<string, string>> {
        const address = await this.getActiveAddress();
        if (address) {
            return { [address]: this.name };
        }
        return {};
    }

    public encrypt(): Promise<Uint8Array> {
        throw new Error('Encrypt is not supported by Arlink Auth');
    }

    public decrypt(): Promise<Uint8Array> {
        throw new Error('Decrypt is not supported by Arlink Auth');
    }

    public async getArweaveConfig(): Promise<unknown> {
        return { host: 'arweave.net', port: 443, protocol: 'https' };
    }

    public async isAvailable(): Promise<boolean> {
        return true;
    }

    public async dispatch(dataItem: unknown): Promise<unknown> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await this.client.dispatch(dataItem as any);
    }

    public async signDataItem(dataItem: unknown): Promise<ArrayBuffer> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await this.client.signDataItem(dataItem as any);
        const raw = result.raw;
        if (raw instanceof ArrayBuffer) return raw;
        return new Uint8Array(raw as number[]).buffer;
    }

    public async signature(
        data: Uint8Array,
        _algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams
    ): Promise<Uint8Array> {
        const result = await this.client.signature({ data });
        return new Uint8Array(result.signature);
    }

    public async signAns104(dataItem: unknown): Promise<{ id: string; raw: ArrayBuffer }> {
        const item = dataItem as { data: unknown; tags?: unknown[]; target?: string; anchor?: string };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await this.client.signDataItem({
            data: item.data,
            tags: item.tags,
            target: item.target,
            anchor: item.anchor,
        } as any);
        const raw = result.raw;
        const buffer = raw instanceof ArrayBuffer ? raw : new Uint8Array(raw as number[]).buffer;
        return { id: result.id, raw: buffer };
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
        const state = this.client.getState();
        const user = state.user as Record<string, unknown> | null;
        const email = (user?.email as string) || '';
        return { email, verified: !!email };
    }

    public getUsername(): string | null {
        try {
            const state = this.client.getState();
            const user = state.user as Record<string, unknown> | null;
            if (!user) return null;

            // For GitHub, use github_username
            if (this.provider === WAuthProviders.Github && user.github_username) {
                return user.github_username as string;
            }

            // Fall back to name
            return (user.name as string) || null;
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
    if (connected && !address) {
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
        localStorage.removeItem('wallet_kit_strategy_id');
        disconnect();
    }
}
