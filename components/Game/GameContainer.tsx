import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus } from '../../utils/web3';

interface GameState {
    isPlaying: boolean;
    score: number;
    playerName: string;
    hasEnteredName: boolean;
}

interface LeaderboardEntry {
    name: string;
    score: number;
    date: string;
}

const GAME_WIDTH = 1200;
const GAME_HEIGHT = 650;
const MOBILE_GAME_HEIGHT = 450;
const MAX_LEADERBOARD_ENTRIES = 100;

export default function GameContainer() {
    const [gameState, setGameState] = useState<GameState>({
        isPlaying: false,
        score: 0,
        playerName: '',
        hasEnteredName: false
    });
    const [isGameOver, setIsGameOver] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [gameHeight, setGameHeight] = useState(GAME_HEIGHT);

    useEffect(() => {
        // Load global leaderboard from API
        console.log('Fetching leaderboard...');
        fetch('/api/scores')
            .then(res => {
                console.log('Leaderboard response:', res.status);
                return res.json();
            })
            .then(scores => {
                console.log('Received scores:', scores);
                setLeaderboard(scores);
            })
            .catch(error => {
                console.error('Error loading leaderboard:', error);
            });

        if (window.ethereum) {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            setProvider(web3Provider);
            // Check if already connected
            web3Provider.listAccounts().then(accounts => {
                setIsConnected(accounts.length > 0);
            });
        }
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setGameHeight(window.innerWidth <= 768 ? MOBILE_GAME_HEIGHT : GAME_HEIGHT);
        };

        handleResize(); // Set initial height
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleConnect = async () => {
        if (!provider) return;
        try {
            if (isConnected) {
                // Disconnect logic
                setIsConnected(false);
                return;
            }
            await provider.send("eth_requestAccounts", []);
            const network = await provider.getNetwork();
            if (network.chainId !== 84532n) { // Base Sepolia chainId
                await window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: "0x14a34" }], // Base Sepolia chainId in hex
                });
            }
            setIsConnected(true);
        } catch (error) {
            console.error('Failed to connect:', error);
            setIsConnected(false);
        }
    };

    const handleMintScore = async () => {
        if (!provider || !gameState.score) return;
        setIsMinting(true);
        try {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            await mintScore(address, gameState.score, (status: TransactionStatus) => {
                console.log('Minting status:', status);
                if (status.status === 'error') {
                    console.error('Minting error:', status.error);
                }
            });
        } catch (error) {
            console.error('Failed to mint:', error);
        } finally {
            setIsMinting(false);
        }
    };

    const handleStartGame = () => {
        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            score: 0,
            hasEnteredName: false,
            playerName: ''
        }));
        setIsGameOver(false);
    };

    const handleGameOver = (finalScore: number) => {
        const roundedScore = Math.floor(finalScore);
        setGameState(prev => ({ ...prev, isPlaying: false, score: roundedScore }));
        setIsGameOver(true);
    };

    const handleNameSubmit = async () => {
        // Only add to leaderboard if name is provided
        if (gameState.playerName) {
            try {
                const response = await fetch('/api/scores', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: gameState.playerName,
                        score: gameState.score,
                        walletAddress: isConnected ? await provider?.getSigner().then(signer => signer.getAddress()) : undefined
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to save score');
                }

                // Refresh leaderboard
                const updatedScores = await fetch('/api/scores').then(res => res.json());
                setLeaderboard(updatedScores);
            } catch (error) {
                console.error('Error saving score:', error);
            }
        }
        setGameState(prev => ({ ...prev, hasEnteredName: true }));
    };

    const handlePlayAgain = () => {
        setGameState({
            isPlaying: true,
            score: 0,
            playerName: '',
            hasEnteredName: false
        });
        setIsGameOver(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.gameWrapper}>
                <Canvas
                    width={GAME_WIDTH}
                    height={gameHeight}
                    isPlaying={gameState.isPlaying}
                    onGameOver={handleGameOver}
                />
                {!gameState.isPlaying && !isGameOver && (
                    <div className={styles.menuContainer}>
                        <div className={styles.instructions}>
                            <h3>How to Play</h3>
                            <p>Press <span className={styles.key}>Space</span> or <span className={styles.key}>Tap</span> to jump</p>
                            <p>Collect Moyaki for power-ups, and avoid Chog and Mooch!</p>
                            <p>The longer you survive, the higher your score!</p>
                        </div>
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
                {isGameOver && !gameState.hasEnteredName && (
                    <div className={styles.gameOverContainer}>
                        <h2>Game Over!</h2>
                        <p>Score: {Math.floor(gameState.score)}</p>
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={gameState.playerName}
                            onChange={(e) => setGameState(prev => ({ ...prev, playerName: e.target.value }))}
                        />
                        <button onClick={handleNameSubmit}>Submit Score</button>
                    </div>
                )}
                {isGameOver && gameState.hasEnteredName && (
                    <div className={styles.gameOverContainer}>
                        <h2>Game Over!</h2>
                        <p>Score: {Math.floor(gameState.score)}</p>
                        <button onClick={handleConnect}>
                            {isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
                        </button>
                        <button
                            onClick={handleMintScore}
                            disabled={isMinting || !isConnected}
                        >
                            {isMinting ? 'Minting...' : 'Mint Score'}
                        </button>
                        <button onClick={handlePlayAgain}>
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