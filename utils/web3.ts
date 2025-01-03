import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { createWeb3Modal } from '@web3modal/wagmi/react';
import { walletConnect } from 'wagmi/connectors';
import { injected } from 'wagmi/connectors';
import * as ethers from 'ethers';

// Contract deployed with signature verification
export const CONTRACT_ADDRESS = "0xBC1994792878aed2B372E7f5a0Cc52a39CB6fBfF";
export const BASE_RPC = "https://base-mainnet.g.alchemy.com/v2/OOkI3aa9CfL9WqO-F_guZS8Qz41cCAjl";

// ABI for the mint function
export const CONTRACT_ABI = [
    "function mint(address to, uint256 amount) public",
    "function mintGameScore(uint256 score, bytes memory signature) public",
    "function balanceOf(address account) public view returns (uint256)"
] as const;

// Get projectId from WalletConnect Cloud
const projectId = '4e31840d1b7a7cf9e7bfbd1ac9074fcc';

// Configure wagmi client
export const config = createConfig({
    chains: [base],
    transports: {
        [base.id]: http(BASE_RPC)
    },
    connectors: [
        walletConnect({
            projectId,
            showQrModal: true
        }),
        injected({ shimDisconnect: true })
    ]
});

// Configure Web3Modal
createWeb3Modal({
    wagmiConfig: config,
    projectId,
    defaultChain: base,
    themeMode: 'light'
});

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
        throw new Error("No Web3 Provider found. Please install a wallet or use WalletConnect.");
    }

    try {
        onStatus({
            status: 'pending',
            message: 'Getting signature from server...'
        });

        // Get signature from our API
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nadrunner.vercel.app';
        const signatureResponse = await fetch(`${apiBaseUrl}/api/generate-score-signature`, {
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

        const { signature, error } = await signatureResponse.json();

        if (error || !signature) {
            throw new Error(error || 'Failed to get signature');
        }

        onStatus({
            status: 'pending',
            message: 'Preparing transaction...'
        });

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = await getContract(provider);

        // Convert score to a whole number and shift by 18 decimals
        const scoreAmount = ethers.parseUnits(Math.floor(score).toString(), 18);
        console.log('Minting with values:', {
            score,
            scoreAmount: scoreAmount.toString(),
            signature
        });

        // Get the gas estimate first
        const gasEstimate = await contract.mintGameScore.estimateGas(scoreAmount, signature);

        // Add 20% buffer to gas estimate
        const gasLimit = Math.floor(Number(gasEstimate) * 1.2);

        onStatus({
            status: 'pending',
            message: 'Please confirm the transaction in your wallet'
        });

        // Send transaction with explicit gas limit
        const tx = await contract.mintGameScore(scoreAmount, signature, {
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

        // Check if it's a validation error from our API
        if (error.message.includes('foul play') || error.message.includes('Invalid gameplay')) {
            errorMessage = `${error.message}\nPlease play the game normally to mint your score.`;
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