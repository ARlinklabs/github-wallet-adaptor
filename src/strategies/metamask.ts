/**
 * AO Wallet Connector - MetaMask Strategy
 * 
 * Strategy for MetaMask Ethereum wallet.
 */

import type { WalletStrategy, AoSignerFunction } from '../types';
import { logger } from '../logger';
import { createData, InjectedEthereumSigner } from 'arbundles/web';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { mainnet } from 'viem/chains';
import { Web3Provider } from '@ethersproject/providers';

declare global {
    interface Window {
        ethereum?: {
            isMetaMask?: boolean;
            providers?: Array<{ isMetaMask?: boolean }>;
            selectedAddress?: string;
            chainId?: string;
            request(args: { method: string; params?: unknown[] }): Promise<unknown>;
            on(event: string, callback: (...args: unknown[]) => void): void;
        };
    }
}

export class MetaMaskWalletStrategy implements WalletStrategy {
    public id = 'metamask';
    public name = 'MetaMask';
    public description = 'MetaMask Ethereum Wallet';
    public theme = '245,130,32'; // MetaMask orange
    public logo = '/logos/metamask.svg';
    public url = 'https://metamask.io';

    private addressListeners: ((address: string) => void)[] = [];
    private currentAddress: string | null = null;
    private walletClient: WalletClient | null = null;

    constructor() {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts: unknown) => {
                const accountsArray = accounts as string[];
                if (accountsArray.length > 0) {
                    this.currentAddress = accountsArray[0];
                    this.addressListeners.forEach(listener => listener(accountsArray[0]));
                } else {
                    this.currentAddress = null;
                }
            });

            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });

            window.ethereum.on('disconnect', () => {
                this.currentAddress = null;
            });
        }
    }

    public async isAvailable(): Promise<boolean> {
        if (typeof window === 'undefined') return false;

        if (window.ethereum?.isMetaMask) {
            return true;
        }

        if (window.ethereum?.providers) {
            return window.ethereum.providers.some(p => p.isMetaMask);
        }

        return false;
    }

    public async connect(): Promise<void> {
        logger.debug('Starting MetaMask connection...');

        if (!window.ethereum) {
            logger.error('window.ethereum not found');
            throw new Error('MetaMask is not installed. Please install it to use this feature.');
        }

        let provider = window.ethereum;

        if (window.ethereum.providers) {
            logger.debug('Multiple wallet providers detected, finding MetaMask...');
            const metamaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
            if (metamaskProvider) {
                provider = metamaskProvider as typeof window.ethereum;
                logger.debug('Found MetaMask provider');
            } else {
                throw new Error('MetaMask not found among installed wallet providers');
            }
        }

        if (!provider?.isMetaMask) {
            throw new Error('Please install MetaMask wallet extension.');
        }

        try {
            logger.debug('Requesting eth_requestAccounts...');

            const accounts = (await provider.request({
                method: 'eth_requestAccounts',
            })) as string[];

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock MetaMask.');
            }

            this.currentAddress = accounts[0];

            this.walletClient = createWalletClient({
                chain: mainnet,
                transport: custom(provider),
            });

            logger.debug('Successfully connected to MetaMask:', this.currentAddress);
        } catch (error) {
            const err = error as { code?: number; message?: string };
            logger.error('MetaMask connection error:', err);

            if (err.code === 4001) {
                throw new Error('User rejected the connection request');
            }

            if (err.code === -32002) {
                throw new Error('Please check MetaMask - a connection request is already pending');
            }

            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        try {
            this.currentAddress = null;
            this.walletClient = null;
            logger.debug('Disconnected from MetaMask');
        } catch (error) {
            logger.error('Error disconnecting MetaMask:', error);
            throw error;
        }
    }

    public async getActiveAddress(): Promise<string> {
        if (!window.ethereum) {
            throw new Error('MetaMask not available');
        }

        try {
            if (this.currentAddress) {
                return this.currentAddress;
            }

            const accounts = (await window.ethereum.request({
                method: 'eth_accounts',
            })) as string[];

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts connected');
            }

            this.currentAddress = accounts[0];
            return accounts[0];
        } catch (error) {
            logger.error('Failed to get active address:', error);
            throw error;
        }
    }

    public async getAllAddresses(): Promise<string[]> {
        if (!window.ethereum) {
            throw new Error('MetaMask not available');
        }

        try {
            const accounts = (await window.ethereum.request({
                method: 'eth_accounts',
            })) as string[];
            return accounts || [];
        } catch (error) {
            logger.error('Failed to get all addresses:', error);
            return [];
        }
    }

    public async getActivePublicKey(): Promise<string> {
        return await this.getActiveAddress();
    }

    public async sign(transaction: unknown): Promise<unknown> {
        if (!window.ethereum || !this.walletClient) {
            throw new Error('MetaMask not available or not connected');
        }

        try {
            const address = await this.getActiveAddress();
            const signature = await this.walletClient.signMessage({
                account: address as `0x${string}`,
                message: typeof transaction === 'string' ? transaction : JSON.stringify(transaction),
            });

            return signature;
        } catch (error) {
            logger.error('Failed to sign transaction:', error);
            throw error;
        }
    }

    public async getPermissions(): Promise<unknown[]> {
        if (!window.ethereum) {
            return [];
        }

        try {
            const permissions = await window.ethereum.request({
                method: 'wallet_getPermissions',
            });
            return (permissions as unknown[]) || [];
        } catch (error) {
            logger.error('Failed to get permissions:', error);
            return [];
        }
    }

    public async getWalletNames(): Promise<Record<string, string>> {
        return {};
    }

    public async signDataItem(dataItem: {
        data: unknown;
        tags: unknown;
        target: unknown;
        anchor: unknown;
    }): Promise<ArrayBuffer> {
        if (!window.ethereum || !this.walletClient) {
            throw new Error('MetaMask not available or not connected');
        }

        try {
            const signer = this.createEthereumDataItemSigner();
            const result = await signer({
                data: dataItem.data,
                tags: dataItem.tags,
                target: dataItem.target,
                anchor: dataItem.anchor,
            });

            if (!result) {
                throw new Error('Failed to sign data item');
            }

            return result.raw.buffer.slice(
                result.raw.byteOffset,
                result.raw.byteOffset + result.raw.byteLength
            ) as ArrayBuffer;
        } catch (error) {
            logger.error('Failed to sign data item:', error);
            throw error;
        }
    }

    public async signAns104(dataItem: {
        data: unknown;
        tags: unknown;
        target: unknown;
        anchor: unknown;
    }): Promise<{ id: string; raw: ArrayBuffer }> {
        if (!window.ethereum || !this.walletClient) {
            throw new Error('MetaMask not available or not connected');
        }

        try {
            const signer = this.createEthereumDataItemSigner();
            const result = await signer({
                data: dataItem.data,
                tags: dataItem.tags,
                target: dataItem.target,
                anchor: dataItem.anchor,
            });

            if (!result) {
                throw new Error('Failed to sign ANS-104 data item');
            }

            return {
                id: result.id,
                raw: result.raw.buffer.slice(
                    result.raw.byteOffset,
                    result.raw.byteOffset + result.raw.byteLength
                ) as ArrayBuffer,
            };
        } catch (error) {
            logger.error('Failed to sign ANS-104:', error);
            throw error;
        }
    }

    private createEthereumDataItemSigner() {
        const strategy = this;

        const signer = async ({
            data,
            tags,
            target,
            anchor,
        }: {
            data: unknown;
            tags: unknown;
            target: unknown;
            anchor: unknown;
        }) => {
            if (!window.ethereum) {
                throw new Error('MetaMask not available');
            }

            const provider = {
                getSigner: () => ({
                    signMessage: async (message: string | Uint8Array) => {
                        const address = await strategy.getActiveAddress();

                        let messageToSign: string;
                        if (message instanceof Uint8Array) {
                            messageToSign = Array.from(message)
                                .map(b => b.toString(16).padStart(2, '0'))
                                .join('');
                        } else {
                            messageToSign = message;
                        }

                        const signature = await window.ethereum!.request({
                            method: 'personal_sign',
                            params: [messageToSign, address],
                        });

                        return signature;
                    },
                }),
            };

            const ethSigner = new InjectedEthereumSigner(provider as never);
            await ethSigner.setPublicKey();

            const dataItem = createData(data as string, ethSigner, { tags, target, anchor } as never);

            const res = await dataItem
                .sign(ethSigner)
                .then(async () => ({
                    id: await dataItem.id,
                    raw: await dataItem.getRaw(),
                }))
                .catch(e => {
                    logger.error('Error signing data item:', e);
                    return null;
                });

            if (res) {
                const isValid = await InjectedEthereumSigner.verify(
                    ethSigner.publicKey,
                    await dataItem.getSignatureData(),
                    dataItem.rawSignature
                );

                logger.debug('Data item signed:', {
                    valid: isValid,
                    id: dataItem.id,
                    owner: dataItem.owner,
                });
            }

            return res;
        };

        return signer;
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

    public getSigner(): AoSignerFunction {
        return this.getAoSigner();
    }

    public getWalletClient(): WalletClient | null {
        return this.walletClient;
    }

    public createBrowserEthereumDataItemSigner(): AoSignerFunction {
        return this.getAoSigner();
    }

    public getAoSigner(): AoSignerFunction {
        if (!window.ethereum) {
            throw new Error('MetaMask not available');
        }

        return async (create: (opts: { publicKey: Uint8Array; type: number; alg: string }) => Promise<Uint8Array>) => {
            logger.debug('Creating data item with Ethereum signature');

            const provider = new Web3Provider(window.ethereum!);
            const ethSigner = new InjectedEthereumSigner(provider);
            await ethSigner.setPublicKey();

            logger.debug('Ethereum signer initialized, public key set');

            const dataToSign = await create({
                publicKey: ethSigner.publicKey,
                type: 3, // SignatureConfig.ETHEREUM
                alg: 'secp256k1',
            });

            logger.debug('Data to sign prepared, signing...');

            const signature = await ethSigner.sign(dataToSign);

            logger.debug('Signature created successfully');

            return {
                signature: signature,
                owner: ethSigner.publicKey,
            };
        };
    }
}
