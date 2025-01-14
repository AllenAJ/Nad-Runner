import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const DEVNET_RPC_URL = process.env.DEVNET_RPC_URL || "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        monadDevnet: {
            url: DEVNET_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 20143,
            gasPrice: "auto",
            verify: {
                etherscan: {
                    apiUrl: "https://brightstar-884.devnet1.monad.xyz"
                }
            }
        }
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};

export default config; 