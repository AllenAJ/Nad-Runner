import { defineChain } from "viem";

const DEVNET_RPC_URL = process.env.NEXT_PUBLIC_DEVNET_RPC_URL!;
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '20143');
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL!;

export const monadDevnet = defineChain({
    id: CHAIN_ID,
    name: "Monad Devnet",
    nativeCurrency: {
        name: "DMON",
        symbol: "DMON",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [DEVNET_RPC_URL],
        },
    },
    blockExplorers: {
        default: {
            name: "Monad Explorer",
            url: EXPLORER_URL,
        },
    },
    chainNamespace: "eip155",
    caipNetworkId: `eip155:${CHAIN_ID}`,
});

export const monadTestnet = defineChain({
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: {
        name: "TMON",
        symbol: "TMON",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ["https://rpc.monad-testnet.category.xyz/rpc/K1E4kI8vesB3xIk9Kh9vflrTnE7wzFL0EGbeZAYc"],
        },
    },
    blockExplorers: {
        default: {
            name: "Monad Testnet",
            url: "https://explorer.monad-testnet.category.xyz",
        },
    },
    chainNamespace: "eip155",
    caipNetworkId: "eip155:10143",
});

// Use devnet by default since that's where we deployed
export const CHAIN = monadDevnet; 