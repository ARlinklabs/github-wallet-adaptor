# ao-wallet-kit

A simplified wallet connection library for AO (Arweave/AO) applications. Provides a clean, ArweaveWalletKit-like API with **auto-prepared signers** that work out of the box with `@permaweb/aoconnect`.

## Features

- 🔌 **Multiple Wallet Support** - Arweave (Wander), MetaMask, WAuth (GitHub, Google, Discord, X)
- ⚡ **Auto-Prepared Signers** - No more manual `prepareAoSigner()` calls
- 🔄 **Auto-Reconnect** - Seamlessly reconnects on page refresh
- 🎯 **Simple Hooks API** - `useWallet()`, `useAoSigner()`, `useAddress()`
- 🔇 **Conditional Logging** - Debug logs only when enabled
- 📦 **Single Provider** - One `<AoWalletProvider>` for everything

## Installation

```bash
npm install ao-wallet-kit
# or
yarn add ao-wallet-kit
# or
pnpm add ao-wallet-kit
```

### Peer Dependencies

Make sure you have React installed:

```bash
npm install react react-dom
```

## Quick Start

### 1. Wrap your app with the provider

```tsx
import { AoWalletProvider } from 'ao-wallet-kit';

function App() {
  return (
    <AoWalletProvider debug={import.meta.env.DEV}>
      <YourApp />
    </AoWalletProvider>
  );
}
```

### 2. Use the wallet hooks

```tsx
import { useWallet, useAoSigner } from 'ao-wallet-kit';
import { spawn } from '@permaweb/aoconnect';

function ConnectButton() {
  const { connected, address, connect, disconnect } = useWallet();
  const { signer } = useAoSigner(); // Already prepared for AO operations!

  const handleSpawn = async () => {
    // signer is ready to use directly - no prepareAoSigner needed!
    const processId = await spawn({
      module: 'YOUR_MODULE_ID',
      scheduler: 'YOUR_SCHEDULER_ID',
      signer, // Just pass it directly!
    });
    console.log('Created process:', processId);
  };

  if (connected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={handleSpawn}>Spawn Process</button>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return <button onClick={connect}>Connect Wallet</button>;
}
```

## API Reference

### Provider

#### `<AoWalletProvider>`

Wrap your app with this provider to enable wallet functionality.

```tsx
<AoWalletProvider
  debug={boolean}        // Enable debug logging (default: false)
  autoConnect={boolean}  // Auto-reconnect on mount (default: true)
  permissions={string[]} // Default Arweave permissions
>
  {children}
</AoWalletProvider>
```

### Hooks

#### `useWallet()`

Main hook for wallet state and actions.

```tsx
const {
  connected,      // boolean - Is wallet connected?
  address,        // string | null - Wallet address
  publicKey,      // string | null - Public key
  strategy,       // WalletStrategy | null - Current wallet strategy
  connect,        // (permissions?: string[]) => Promise<void>
  disconnect,     // () => Promise<void>
  setStrategy,    // (strategyId: string) => boolean
  getStrategies,  // () => WalletStrategy[]
} = useWallet();
```

#### `useAoSigner()`

Get an auto-prepared signer for AO operations.

```tsx
const { signer, isLoading } = useAoSigner();

// Use directly with @permaweb/aoconnect
await spawn({ module, scheduler, signer });
await message({ process, signer, data, tags });
```

#### `useAddress()`

Simple hook to get just the wallet address.

```tsx
const address = useAddress(); // string | null
```

#### `useWalletType()`

Check the current wallet type.

```tsx
const { isWAuth, isMetaMask, isArweaveNative } = useWalletType();
```

#### `useWAuthData()`

Get WAuth-specific user data (for OAuth wallets).

```tsx
const { email, username } = useWAuthData();
```

### Wallet Manager

For advanced use cases, you can access the wallet manager directly:

```tsx
import { walletManager } from 'ao-wallet-kit';

// Set a specific wallet strategy
walletManager.setStrategy('wauth-github');
walletManager.setStrategy('metamask');
walletManager.setStrategy('arweave-native');

// Connect
await walletManager.connect();

// Get state
const state = walletManager.getState();
```

## Supported Wallets

| Wallet | Strategy ID | Description |
|--------|-------------|-------------|
| **Wander** | `arweave-native` | Native Arweave wallet (browser extension) |
| **MetaMask** | `metamask` | Ethereum wallet with Arweave bridge |
| **GitHub** | `wauth-github` | WAuth OAuth - GitHub login |
| **Google** | `wauth-google` | WAuth OAuth - Google login |
| **Discord** | `wauth-discord` | WAuth OAuth - Discord login |
| **X (Twitter)** | `wauth-twitter` | WAuth OAuth - X login |

## Debug Logging

Debug logs are disabled by default. Enable them via:

1. **Provider prop**: `<AoWalletProvider debug={true}>`
2. **localStorage**: `localStorage.setItem('wallet_debug', 'true')`
3. **Environment**: `VITE_WALLET_DEBUG=true`

## Comparison with ArweaveWalletKit

| Feature | ao-wallet-kit | ArweaveWalletKit |
|---------|---------------|------------------|
| Auto-prepared signer | ✅ Yes | ❌ No |
| WAuth support | ✅ Built-in | ❌ No |
| MetaMask support | ✅ Built-in | ❌ No |
| Debug logging | ✅ Conditional | ❌ Always on |
| Auto-reconnect | ✅ Built-in | ⚠️ Manual |
| Bundle size | ~15KB | ~25KB |

## Migration from ArweaveWalletKit

```tsx
// Before (ArweaveWalletKit)
import { ArweaveWalletKit, useConnection, useApi } from 'arweave-wallet-kit';

<ArweaveWalletKit config={{ permissions: [...] }}>
  <App />
</ArweaveWalletKit>

const { connected } = useConnection();
const api = useApi();
const signer = createDataItemSigner(api); // Manual!

// After (ao-wallet-kit)
import { AoWalletProvider, useWallet, useAoSigner } from 'ao-wallet-kit';

<AoWalletProvider>
  <App />
</AoWalletProvider>

const { connected } = useWallet();
const { signer } = useAoSigner(); // Auto-prepared!
```

## TypeScript Support

ao-wallet-kit is written in TypeScript and includes full type definitions.

```tsx
import type { 
  WalletStrategy, 
  WalletConnectionState,
  AoSignerFunction 
} from 'ao-wallet-kit';
```

## License

MIT © [Arlink Labs](https://github.com/ArlinkLabs)

## Contributing

Contributions are welcome! Please read our [contributing guide](CONTRIBUTING.md) first.

## Links

- [GitHub Repository](https://github.com/ArlinkLabs/ao-wallet-kit)
- [npm Package](https://www.npmjs.com/package/ao-wallet-kit)
- [Arlink](https://arlink.io)
- [AO Documentation](https://ao.arweave.dev)
