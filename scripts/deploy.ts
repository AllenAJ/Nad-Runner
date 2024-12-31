import { ethers } from "hardhat";

async function main() {
    const MonadRunTestToken = await ethers.getContractFactory("MonadRunTestToken");
    const token = await MonadRunTestToken.deploy();
    await token.waitForDeployment();

    const address = await token.getAddress();
    console.log("MonadRunTestToken deployed to:", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 