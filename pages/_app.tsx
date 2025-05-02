import React, { useMemo, FC, ReactNode } from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, WagmiConfig } from 'wagmi';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { CHAIN } from '../utils/chains';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { InventoryProvider } from '../contexts/InventoryContext';

// Solana Wallet Adapter imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    // Add other wallets you want to support
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '../styles/globals.css';
require('@solana/wallet-adapter-react-ui/styles.css'); // Solana Wallet UI styles

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!;

const metadata = {
    name: 'Nadrunner',
    description: 'Nadrunner Game',
    url: 'https://nadrunner.vercel.app',
    icons: ['https://nadrunner.vercel.app/favicon.ico']
};

const wagmiConfig = defaultWagmiConfig({
    projectId,
    metadata,
    chains: [CHAIN as any] // Type assertion needed due to chain definition differences
});

createWeb3Modal({
    wagmiConfig,
    projectId,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-font-family': 'Roboto, sans-serif'
    }
});

const queryClient = new QueryClient();

// Create a new component for Solana providers for clarity
interface SolanaProvidersProps {
    children: ReactNode;
}

const SolanaWalletContextProviders: FC<SolanaProvidersProps> = ({ children }) => {
    const network = WalletAdapterNetwork.Devnet; // Or Testnet, Mainnet-beta
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            // Add other wallet adapters here if needed
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <WagmiConfig config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <SolanaWalletContextProviders>
                    <InventoryProvider>
                        <Component {...pageProps} />
                    </InventoryProvider>
                </SolanaWalletContextProviders>
            </QueryClientProvider>
        </WagmiConfig>
    );
}

export default MyApp;
