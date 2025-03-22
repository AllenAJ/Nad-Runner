import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

interface Web3ContextType {
    account: string | null;
    connectWallet: () => Promise<void>;
    mintTokens: (score: number) => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
    const [account, setAccount] = useState<string | null>(null);

    // Contract details
    const CONTRACT_ADDRESS = "0xF507dE1de9b36eD3E98c0D4b882C6a82b8C1E2dc";

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts'
                });
                setAccount(accounts[0]);
            } else {
                alert('Please install a Web3 wallet like MetaMask or Rabby!');
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    const mintTokens = async (score: number) => {
        try {
            if (!account) throw new Error('Wallet not connected');

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Get contract interface
            const abi = ["function mint(address to, uint256 amount) public"];
            const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

            // Mint tokens equal to score
            const tx = await contract.mint(account, ethers.parseEther(score.toString()));
            await tx.wait();

            alert(`Successfully minted ${score} tokens!`);
        } catch (error) {
            console.error('Error minting tokens:', error);
            alert('Failed to mint tokens. See console for details.');
        }
    };

    return (
        <Web3Context.Provider value={{ account, connectWallet, mintTokens }}>
            {children}
        </Web3Context.Provider>
    );
}

export const useWeb3 = () => {
    const context = useContext(Web3Context);
    if (!context) throw new Error('useWeb3 must be used within a Web3Provider');
    return context;
}; 