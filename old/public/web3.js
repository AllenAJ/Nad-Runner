// Remove import and use script tag in HTML instead
window.initWeb3 = async function () {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            console.log('Web3 initialized');
            return { provider, signer };
        } catch (error) {
            console.error('Error initializing web3:', error);
        }
    } else {
        console.log('Please install MetaMask or another Web3 wallet');
    }
}