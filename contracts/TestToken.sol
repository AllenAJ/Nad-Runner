// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MonadRunTestToken is ERC20, Ownable {
    // Maximum tokens that can be minted per game
    uint256 public constant MAX_GAME_MINT = 10000 ether;  // 10,000 tokens with 18 decimals
    
    constructor() ERC20("MonadRun Test Token", "MRTEST") Ownable(msg.sender) {}

    // Admin mint function for testing
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // Public mint function for game scores
    function mintGameScore(uint256 score) public {
        require(score <= MAX_GAME_MINT, "Score exceeds maximum allowed mint");
        _mint(msg.sender, score);
    }
} 