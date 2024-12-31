import React from 'react';
import type { AppProps } from 'next/app';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../utils/web3';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { baseSepolia } from 'wagmi/chains';

const queryClient = new QueryClient();

// Initialize Web3Modal
createWeb3Modal({
    wagmiConfig: config,
    projectId: 'YOUR_PROJECT_ID',
    defaultChain: baseSepolia,
    themeMode: 'dark'
});

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <Component {...pageProps} />
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export default MyApp;
