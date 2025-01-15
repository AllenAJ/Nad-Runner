import React from 'react';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, WagmiConfig } from 'wagmi';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { CHAIN } from '../utils/chains';
import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';

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

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <WagmiConfig config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <Component {...pageProps} />
            </QueryClientProvider>
        </WagmiConfig>
    );
}

export default MyApp;
