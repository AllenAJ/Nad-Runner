import { ethers } from "hardhat";

async function main() {
    console.log("Deploying Nadrunner Token to Base mainnet...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    const Token = await ethers.getContractFactory("NadrunnerToken");
    const token = await Token.deploy();
    await token.waitForDeployment();

    const address = await token.getAddress();
    console.log("Token deployed to:", address);

    console.log("\nVerification command:");
    console.log(`npx hardhat verify --network base ${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 