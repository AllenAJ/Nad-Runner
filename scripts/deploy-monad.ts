import { ethers } from "hardhat";
import { verify } from "./verify";

async function main() {
    console.log("🚀 Starting deployment to Monad...");

    try {
        const [deployer] = await ethers.getSigners();
        const deployerAddress = await deployer.getAddress();

        console.log("🔑 Deploying with account:", deployerAddress);
        console.log("💰 Account balance:", (await deployer.provider.getBalance(deployerAddress)).toString());

        // Deploy the contract
        console.log("\n🏗 Deploying NadrunnerToken...");
        const NadrunnerToken = await ethers.getContractFactory("NadrunnerToken");
        const token = await NadrunnerToken.deploy();

        console.log("⏱ Waiting for deployment transaction...");
        const deployTxHash = token.deploymentTransaction()?.hash;
        console.log("📝 Deployment transaction hash:", deployTxHash);

        await token.waitForDeployment();
        const tokenAddress = await token.getAddress();

        console.log("\n✅ NadrunnerToken deployed successfully!");
        console.log("📄 Contract address:", tokenAddress);
        console.log("\n⚡ Deployment complete! ⚡\n");

        // Save this address for your configuration
        console.log("-----------------------------------");
        console.log("🔔 Important: Update your configuration!");
        console.log("Copy this address to your web3.ts CONTRACT_ADDRESS:");
        console.log(tokenAddress);
        console.log("-----------------------------------");

        // Verify the contract if we're on a network that supports verification
        if (process.env.CHAIN_ENV === "devnet") {
            console.log("\n🔍 Verifying contract on Monad Explorer...");
            try {
                await verify(tokenAddress, []);
                console.log("✅ Contract verified successfully!");
            } catch (error) {
                console.log("⚠️ Verification failed:", error);
            }
        }

    } catch (error) {
        console.error("\n❌ Deployment failed!");
        console.error(error);
        process.exitCode = 1;
    }
}

main(); 