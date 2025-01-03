import { ethers } from "hardhat";

async function main() {
    // Get the private key from environment variable
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerPrivateKey) {
        throw new Error("SIGNER_PRIVATE_KEY not found in environment variables");
    }

    // Calculate the signer address from the private key
    const wallet = new ethers.Wallet(signerPrivateKey);
    const signerAddress = wallet.address;

    console.log("Setting signer address:", signerAddress);

    // Get the contract
    const token = await ethers.getContractAt(
        "contracts/NadrunnerToken.sol:NadrunnerToken",
        "0xBC1994792878aed2B372E7f5a0Cc52a39CB6fBfF"
    );

    // Set the signer
    const tx = await token.setSigner(signerAddress);
    await tx.wait();

    console.log("Signer address set successfully!");
    console.log("Transaction hash:", tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 