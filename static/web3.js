import { ethers } from 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js';

const CONTRACT_ADDRESS = '0x...'; // Replace with your actual contract address
const CONTRACT_ABI = []; // Replace with your actual contract ABI

async function postScoreOnchain(score) {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask to use this feature!');
        return;
    }

    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        const tx = await contract.postScore(score);
        await tx.wait();
        alert('Score posted successfully!');
    } catch (error) {
        console.error('Error posting score:', error);
        alert('Failed to post score. Please try again.');
    }
}

export { postScoreOnchain };