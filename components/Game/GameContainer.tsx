import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';

interface GameState {
    isPlaying: boolean;
    score: number;
    playerName: string;
}

interface LeaderboardEntry {
    name: string;
    score: number;
    date: string;
}

const GAME_WIDTH = 1600;
const GAME_HEIGHT = 800;
const MAX_LEADERBOARD_ENTRIES = 10;

export default function GameContainer() {
    const [gameState, setGameState] = useState<GameState>({
        isPlaying: false,
        score: 0,
        playerName: ''
    });
    const [isGameOver, setIsGameOver] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        // Load leaderboard from localStorage
        const savedLeaderboard = localStorage.getItem('monadrun_leaderboard');
        if (savedLeaderboard) {
            setLeaderboard(JSON.parse(savedLeaderboard));
        }

        if (window.ethereum) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
        }
    }, []);

    const handleConnect = async () => {
        if (!provider) return;
        try {
            await provider.send("eth_requestAccounts", []);
            const network = await provider.getNetwork();
            if (network.chainId !== 84532n) { // Base Sepolia chainId
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0x14a34" }], // Base Sepolia chainId in hex
                });
            }
        } catch (error) {
            console.error('Failed to connect:', error);
        }
    };

    const handleMintScore = async () => {
        if (!provider || !gameState.score) return;
        setIsMinting(true);
        try {
            const signer = await provider.getSigner();
            // Contract interaction code here
            // We'll add this back once the basic build works
        } catch (error) {
            console.error('Failed to mint:', error);
        } finally {
            setIsMinting(false);
        }
    };

    const handleStartGame = () => {
        if (!gameState.playerName) return;
        setGameState(prev => ({ ...prev, isPlaying: true }));
        setIsGameOver(false);
    };

    const handleGameOver = (finalScore: number) => {
        const roundedScore = Math.floor(finalScore);
        setGameState(prev => ({ ...prev, isPlaying: false, score: roundedScore }));
        setIsGameOver(true);

        // Update leaderboard if score qualifies
        if (gameState.playerName) {
            const newEntry: LeaderboardEntry = {
                name: gameState.playerName,
                score: roundedScore,
                date: new Date().toISOString()
            };

            const updatedLeaderboard = [...leaderboard, newEntry]
                .sort((a, b) => b.score - a.score)
                .slice(0, MAX_LEADERBOARD_ENTRIES);

            setLeaderboard(updatedLeaderboard);
            localStorage.setItem('monadrun_leaderboard', JSON.stringify(updatedLeaderboard));
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.gameWrapper}>
                <Canvas
                    width={GAME_WIDTH}
                    height={GAME_HEIGHT}
                    isPlaying={gameState.isPlaying}
                    onGameOver={handleGameOver}
                />
                {!gameState.isPlaying && !isGameOver && (
                    <div className={styles.menuContainer}>
                        <div className={styles.instructions}>
                            <h3>How to Play</h3>
                            <p>Press <span className={styles.key}>Space</span> or <span className={styles.key}>Tap</span> to jump</p>
                            <p>Collect power-ups and avoid obstacles</p>
                            <p>The longer you survive, the higher your score!</p>
                        </div>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={gameState.playerName}
                            onChange={(e) => setGameState(prev => ({ ...prev, playerName: e.target.value }))}
                        />
                        <button onClick={handleStartGame}>Start Game</button>
                        {leaderboard.length > 0 && (
                            <div className={styles.leaderboard}>
                                <h3>Top Scores</h3>
                                {leaderboard.map((entry, index) => (
                                    <div key={index} className={styles.leaderboardEntry}>
                                        <span className={styles.rank}>#{index + 1}</span>
                                        <span className={styles.name}>{entry.name}</span>
                                        <span className={styles.score}>{Math.floor(entry.score)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {isGameOver && (
                    <div className={styles.gameOverContainer}>
                        <h2>Game Over!</h2>
                        <p>Score: {Math.floor(gameState.score)}</p>
                        <button onClick={handleConnect}>Connect Wallet</button>
                        <button
                            onClick={handleMintScore}
                            disabled={isMinting}
                        >
                            {isMinting ? 'Minting...' : 'Mint Score'}
                        </button>
                        <button onClick={() => setGameState(prev => ({ ...prev, isPlaying: true }))}>
                            Play Again
                        </button>
                        {leaderboard.length > 0 && (
                            <div className={styles.leaderboard}>
                                <h3>Top Scores</h3>
                                {leaderboard.map((entry, index) => (
                                    <div key={index} className={styles.leaderboardEntry}>
                                        <span className={styles.rank}>#{index + 1}</span>
                                        <span className={styles.name}>{entry.name}</span>
                                        <span className={styles.score}>{Math.floor(entry.score)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
} 