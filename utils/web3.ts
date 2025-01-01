import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { walletConnect } from 'wagmi/connectors';
import { injected } from 'wagmi/connectors';
import * as ethers from 'ethers';

export const CONTRACT_ADDRESS = "0x1a25493e789Bd6bb22Ab41744e2dCA3B2806e076";
export const BASE_SEPOLIA_RPC = "https://base-sepolia.g.alchemy.com/v2/OOkI3aa9CfL9WqO-F_guZS8Qz41cCAjl";

// ABI for the mint function
export const CONTRACT_ABI = [
    "function mint(address to, uint256 amount) public",
    "function mintGameScore(uint256 score) public",
    "function balanceOf(address account) public view returns (uint256)"
] as const;

// Get projectId from WalletConnect Cloud - https://cloud.walletconnect.com/
const projectId = '4e31840d1b7a7cf9e7bfbd1ac9074fcc';

export const config = createConfig({
    chains: [baseSepolia],
    transports: {
        [baseSepolia.id]: http(BASE_SEPOLIA_RPC)
    },
    connectors: [
        injected(),
        walletConnect({ projectId })
    ]
});

createWeb3Modal({
    wagmiConfig: config,
    projectId,
    defaultChain: baseSepolia,
    themeMode: 'dark'
});

export const getContract = async (signer: any) => {
    if (!signer) throw new Error("No signer available");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const connectedSigner = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, connectedSigner);
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
    onStatus: (status: TransactionStatus) => void
) => {
    if (!window.ethereum) throw new Error("No Web3 Provider found");

    try {
        onStatus({
            status: 'pending',
            message: 'Preparing transaction...'
        });

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = await getContract(signer);

        // Convert score to a whole number and shift by 18 decimal places
        const scoreAmount = ethers.parseUnits(Math.floor(score).toString(), 18);

        // Get the gas estimate first
        const gasEstimate = await contract.mintGameScore.estimateGas(scoreAmount);

        // Add 20% buffer to gas estimate
        const gasLimit = Math.floor(Number(gasEstimate) * 1.2);

        onStatus({
            status: 'pending',
            message: 'Please confirm the transaction in your wallet'
        });

        // Send transaction with explicit gas limit
        const tx = await contract.mintGameScore(scoreAmount, {
            gasLimit: gasLimit
        });

        onStatus({
            status: 'mining',
            message: 'Transaction is being mined...',
            hash: tx.hash
        });

        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);

        onStatus({
            status: 'success',
            message: 'Score minted successfully! 🎉',
            hash: tx.hash
        });

        return tx;
    } catch (error: any) {
        console.error('Detailed error:', error);

        let errorMessage = 'Failed to mint score. Please try again.';

        // Check if it's a revert error
        if (error.code === 'CALL_EXCEPTION') {
            errorMessage = 'Transaction failed: Score might exceed maximum allowed (10,000 tokens)';
        }

        // Check if it's a gas estimation error
        if (error.message.includes('estimateGas')) {
            errorMessage = 'Failed to estimate gas: The transaction might revert. Score might be too high.';
        }

        onStatus({
            status: 'error',
            message: errorMessage,
            error: error.message
        });

        throw error;
    }
}; 