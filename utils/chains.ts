import { defineChain } from "viem";

export const monadTestnet = defineChain({
    id: 10143,
    name: "Monad Testnet",
    nativeCurrency: {
        name: "MON",
        symbol: "MON",
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ["https://testnet-rpc.monad.xyz"],
        },
    },
    blockExplorers: {
        default: {
            name: "Monad Testnet Explorer",
            url: "https://testnet.monadexplorer.com",
        },
    },
    chainNamespace: "eip155",
    caipNetworkId: "eip155:10143",
});

// Set Monad Testnet as the default chain
export const CHAIN = monadTestnet;