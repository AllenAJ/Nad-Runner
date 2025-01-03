// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract NadrunnerToken is ERC20, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 public constant MAX_GAME_MINT = 10000 ether;  // 10,000 tokens with 18 decimals
    address public signer;  // Address authorized to sign mint requests
    
    // Mapping to track used nonces
    mapping(bytes32 => bool) public usedSignatures;
    
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    constructor() ERC20("Nadrunner", "NADR") Ownable(msg.sender) {
        signer = msg.sender; // Initially set owner as signer
    }

    // Update signer address - only owner can call
    function setSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer address");
        address oldSigner = signer;
        signer = newSigner;
        emit SignerUpdated(oldSigner, newSigner);
    }

    // Admin mint function for testing
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Verify and mint game score
    function mintGameScore(uint256 score, bytes memory signature) public {
        require(score <= MAX_GAME_MINT, "Score exceeds maximum allowed mint");
        
        // Create message hash
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,    // Player address
            score,         // Score amount
            block.chainid  // Chain ID for cross-chain replay protection
        ));

        // Convert to Ethereum Signed Message hash
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Verify signature
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(recoveredSigner == signer, "Invalid signature");

        // Mark signature as used
        usedSignatures[messageHash] = true;

        // Mint tokens
        _mint(msg.sender, score);
    }
} 