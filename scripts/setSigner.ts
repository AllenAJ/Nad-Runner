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
        "0x0C847d8D9F71f1b11a708E1CB0c4d7e1C643F500"
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