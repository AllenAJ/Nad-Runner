declare global {
    interface Window {
        ethereum?: any;
    }
}

import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { CHAIN } from './chains';
import * as ethers from 'ethers';

// Contract deployed with signature verification
export const CONTRACT_ADDRESS = "0xF507dE1de9b36eD3E98c0D4b882C6a82b8C1E2dc";

// ABI for the mint function
export const CONTRACT_ABI = [
    "function mint(address to, uint256 amount) public",
    "function mintGameScore(uint256 score, bytes memory signature) public",
    "function balanceOf(address account) public view returns (uint256)"
] as const;

// Create Viem public client
export const publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(CHAIN.rpcUrls.default.http[0])
});

// Create wallet client when needed
export const createWallet = () => {
    if (!window.ethereum) throw new Error("No Web3 Provider found");
    return createWalletClient({
        chain: CHAIN,
        transport: custom(window.ethereum)
    });
};

// Function to switch network
async function switchToMonadNetwork(provider: any) {
    const chainIdHex = `0x${CHAIN.id.toString(16)}`;
    console.log('Attempting to switch to chain:', {
        chainId: CHAIN.id,
        chainIdHex,
        name: CHAIN.name,
        rpcUrl: CHAIN.rpcUrls.default.http[0]
    });

    try {
        // First try to switch
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
        });
    } catch (switchError: any) {
        console.log('Switch error:', switchError);

        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902 || switchError.code === -32603) {
            try {
                console.log('Adding network to wallet...');
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: chainIdHex,
                        chainName: CHAIN.name,
                        nativeCurrency: {
                            name: CHAIN.nativeCurrency.name,
                            symbol: CHAIN.nativeCurrency.symbol,
                            decimals: CHAIN.nativeCurrency.decimals
                        },
                        rpcUrls: CHAIN.rpcUrls.default.http,
                        blockExplorerUrls: CHAIN.blockExplorers?.default ? [CHAIN.blockExplorers.default.url] : undefined
                    }]
                });

                // After adding, try switching again
                console.log('Network added, attempting to switch again...');
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chainIdHex }],
                });
            } catch (addError: any) {
                console.error('Error adding network:', addError);
                throw new Error(`Failed to add Monad network. Please add it manually with:\nNetwork Name: ${CHAIN.name}\nRPC URL: ${CHAIN.rpcUrls.default.http[0]}\nChain ID: ${CHAIN.id}\nSymbol: ${CHAIN.nativeCurrency.symbol}`);
            }
        } else if (switchError.code === 4001) {
            throw new Error('User rejected the network switch. Please try again and approve the network switch in your wallet.');
        } else {
            console.error('Error switching network:', switchError);
            throw new Error(`Please add Monad network to your wallet manually:\nNetwork Name: ${CHAIN.name}\nRPC URL: ${CHAIN.rpcUrls.default.http[0]}\nChain ID: ${CHAIN.id}\nSymbol: ${CHAIN.nativeCurrency.symbol}`);
        }
    }

    // Verify we're on the correct network
    try {
        const currentChainId = await provider.request({ method: 'eth_chainId' });
        if (currentChainId.toLowerCase() !== chainIdHex.toLowerCase()) {
            throw new Error(`Network switch failed. Expected ${chainIdHex}, got ${currentChainId}`);
        }
    } catch (error) {
        console.error('Error verifying network:', error);
        throw new Error('Failed to verify network switch. Please ensure you are on the Monad network.');
    }
}

export const getContract = async (provider: any) => {
    if (!provider) throw new Error("No provider available");
    try {
        const signer = await provider.getSigner();
        return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    } catch (error) {
        console.error("Error getting contract:", error);
        throw error;
    }
};

export type TransactionStatus = {
    status: 'pending' | 'mining' | 'success' | 'error';
    message: string;
    hash?: string;
    error?: string;
};

export const mintScore = async (
    address: string,
    score: number,
    gameStartTime: number,
    gameEndTime: number,
    onStatus: (status: TransactionStatus) => void
) => {
    if (!window.ethereum) {
        throw new Error("No Web3 Provider found. Please install a wallet.");
    }

    try {
        onStatus({
            status: 'pending',
            message: 'Getting signature from server...'
        });

        // Get signature from our API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nadrunner.vercel.app';
        const signatureResponse = await fetch(`${apiUrl}/api/generate-score-signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                playerAddress: address,
                score: score,
                gameStartTime: gameStartTime,
                gameEndTime: gameEndTime
            })
        });

        const data = await signatureResponse.json();

        if (!signatureResponse.ok) {
            throw new Error(data.error || 'Failed to get signature from server');
        }

        if (!data.signature) {
            throw new Error('No signature received from server');
        }

        onStatus({
            status: 'pending',
            message: 'Preparing transaction...'
        });

        // First ensure we're on the right network
        onStatus({
            status: 'pending',
            message: 'Checking network...'
        });

        await switchToMonadNetwork(window.ethereum);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = await getContract(provider);

        // Convert score to a whole number and shift by 18 decimals
        const scoreAmount = ethers.parseUnits(Math.floor(score).toString(), 18);

        onStatus({
            status: 'pending',
            message: 'Please confirm the transaction in your wallet'
        });

        // Send transaction with fixed gas limit for Monad
        const tx = await contract.mintGameScore(scoreAmount, data.signature, {
            gasLimit: 500000 // Fixed gas limit for Monad
        });

        onStatus({
            status: 'mining',
            message: 'Transaction is being mined...',
            hash: tx.hash
        });

        const receipt = await tx.wait();

        onStatus({
            status: 'success',
            message: 'Score minted successfully! 🎉',
            hash: tx.hash
        });

        return tx;
    } catch (error: any) {
        console.error('Detailed error:', error);

        let errorMessage = 'Failed to mint score. Please try again.';

        // Check if it's a validation error from our API
        if (error.message.includes('foul play') || error.message.includes('Invalid gameplay')) {
            errorMessage = error.message;
        }
        // Check if it's a network switching error
        else if (error.message.includes('network')) {
            errorMessage = error.message;
        }
        // Check if it's a revert error
        else if (error.code === 'CALL_EXCEPTION') {
            errorMessage = 'Transaction failed: Score might exceed maximum allowed (10,000 tokens)';
        }
        // Check if it's a gas estimation error
        else if (error.message.includes('estimateGas')) {
            errorMessage = 'Failed to estimate gas: The transaction might revert.';
        }

        onStatus({
            status: 'error',
            message: errorMessage,
            error: error.message
        });

        throw error;
    }
}; 