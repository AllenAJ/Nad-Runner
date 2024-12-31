import { ethers } from "hardhat";

async function main() {
    // Store the address where we deployed our contract
    const CONTRACT_ADDRESS = "0xF507dE1de9b36eD3E98c0D4b882C6a82b8C1E2dc";

    // Get a reference to our deployed contract
    // ethers.getContractAt(ContractName, ContractAddress) creates an interface to interact with the contract
    const token = await ethers.getContractAt("MonadRunTestToken", CONTRACT_ADDRESS);

    // Convert 100 tokens to the correct number of decimals (18)
    // 1 token = 1000000000000000000 (18 zeros)
    // parseEther("100") = 100000000000000000000
    const amountToMint = ethers.parseEther("100");

    // Get the wallet address that will send the transaction
    // This uses the private key from our .env file
    const [signer] = await ethers.getSigners();

    // Call the mint function on our contract
    // tx is the transaction object
    const tx = await token.mint(signer.address, amountToMint);

    // Wait for the transaction to be confirmed on the blockchain
    await tx.wait();

    // Log how many tokens we minted and to which address
    console.log(`Minted ${ethers.formatEther(amountToMint)} tokens to ${signer.address}`);

    // Check the balance after minting
    // balanceOf is a standard ERC20 function
    const balance = await token.balanceOf(signer.address);
    console.log(`New balance: ${ethers.formatEther(balance)} tokens`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 