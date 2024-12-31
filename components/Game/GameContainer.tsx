import React from 'react';
import { useEffect, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import Canvas from './Canvas';
import styles from './GameContainer.module.css';
import { mintScore, TransactionStatus } from '../../utils/web3';

interface LeaderboardEntry {
    name: string;
    score: number;
    date: string;
}

const GAME_WIDTH = 1600;
const GAME_HEIGHT = 800;
const MAX_LEADERBOARD_ENTRIES = 20;

const GameContainer: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [score, setScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [mintError, setMintError] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<TransactionStatus | null>(null);
    const [playerName, setPlayerName] = useState('');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [showNameInput, setShowNameInput] = useState(false);

    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const { open: openWeb3Modal } = useWeb3Modal();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (!isPlaying && !isGameOver) {
                    setIsPlaying(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, isGameOver]);

    useEffect(() => {
        // Load leaderboard from localStorage on mount
        const savedLeaderboard = localStorage.getItem('monadrun_leaderboard');
        if (savedLeaderboard) {
            setLeaderboard(JSON.parse(savedLeaderboard));
        }
    }, []);

    const handleGameOver = (finalScore: number) => {
        setIsPlaying(false);
        setIsGameOver(true);
        const roundedScore = Math.floor(finalScore);
        setScore(roundedScore);

        // Check if score qualifies for leaderboard
        const isHighScore = leaderboard.length < MAX_LEADERBOARD_ENTRIES ||
            roundedScore > leaderboard[leaderboard.length - 1]?.score;

        if (isHighScore) {
            setShowNameInput(true);
        }
    };

    const handleNameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!playerName.trim()) return;

        const newEntry: LeaderboardEntry = {
            name: playerName.trim(),
            score: score,
            date: new Date().toISOString()
        };

        const updatedLeaderboard = [...leaderboard, newEntry]
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_LEADERBOARD_ENTRIES);

        setLeaderboard(updatedLeaderboard);
        localStorage.setItem('monadrun_leaderboard', JSON.stringify(updatedLeaderboard));
        setShowNameInput(false);
        setPlayerName('');
    };

    const handleMintScore = async () => {
        try {
            setIsMinting(true);
            setMintError(null);
            setTxStatus(null);

            // Check if we're on Base Sepolia first
            if (chainId !== baseSepolia.id) {
                if (switchChain) {
                    await switchChain({ chainId: baseSepolia.id });
                } else {
                    throw new Error("Please switch to Base Sepolia network manually");
                }
                return;
            }

            // Only open modal if not connected
            if (!isConnected) {
                await openWeb3Modal();
                return;
            }

            if (!address) {
                throw new Error("No wallet address found");
            }

            const tx = await mintScore(address, score, setTxStatus);
            console.log('Transaction hash:', tx.hash);

        } catch (error: any) {
            console.error('Error minting score:', error);
            setMintError(error.message || 'Failed to mint score. Please try again.');
        } finally {
            setIsMinting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await disconnect();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    const getExplorerLink = (hash: string) => {
        return `https://sepolia.basescan.org/tx/${hash}`;
    };

    const handlePlayAgain = () => {
        setIsGameOver(false);
        setScore(0);
        setMintError(null);
        setIsPlaying(true);
    };

    const getMintButtonText = () => {
        if (isMinting) return 'Minting...';
        if (!isConnected) return 'Connect Wallet to Mint';
        if (chainId !== baseSepolia.id) return 'Switch to Base Sepolia';
        return 'Mint Score';
    };

    return (
        <div className={styles.container}>
            <div className={styles.gameWrapper}>
                <Canvas
                    width={GAME_WIDTH}
                    height={GAME_HEIGHT}
                    isPlaying={isPlaying}
                    onGameOver={(finalScore) => handleGameOver(finalScore)}
                />
                {!isPlaying && !isGameOver && (
                    <div className={styles.overlay}>
                        <div className={styles.gameInstructions}>
                            <h3>How to Play</h3>
                            <p>Press <span className={styles.controls}>Space</span> or <span className={styles.controls}>Tap</span> to jump</p>
                            <p>Collect power-ups and avoid obstacles</p>
                            <p>The longer you survive, the higher your score!</p>
                        </div>
                        <div className={styles.menuContainer}>
                            <button
                                className={styles.startButton}
                                onClick={() => setIsPlaying(true)}
                            >
                                Start Game
                            </button>
                            {leaderboard.length > 0 && (
                                <div className={styles.leaderboard}>
                                    <h2>Top Scores</h2>
                                    <div className={styles.leaderboardList}>
                                        {leaderboard.map((entry, index) => (
                                            <div key={index} className={styles.leaderboardEntry}>
                                                <span className={styles.rank}>#{index + 1}</span>
                                                <span className={styles.name}>{entry.name}</span>
                                                <span className={styles.score}>{entry.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {isGameOver && (
                    <div className={`${styles.overlay} ${styles.gameOver}`}>
                        <div className={styles.gameOverContainer}>
                            <h2 className={styles.gameOverTitle}>Game Over!</h2>
                            <p className={styles.finalScore}>Final Score: {score}</p>

                            {showNameInput ? (
                                <form onSubmit={handleNameSubmit} className={styles.nameInputForm}>
                                    <p>New High Score! Enter your name:</p>
                                    <input
                                        type="text"
                                        maxLength={20}
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        className={styles.nameInput}
                                        placeholder="Your Name"
                                        autoFocus
                                    />
                                    <button type="submit" className={styles.submitNameButton}>
                                        Submit
                                    </button>
                                </form>
                            ) : (
                                <>
                                    {mintError && (
                                        <p className={styles.errorMessage}>{mintError}</p>
                                    )}
                                    {txStatus && (
                                        <div className={`${styles.txStatus} ${styles[txStatus.status]}`}>
                                            <p>{txStatus.message}</p>
                                            {txStatus.hash && (
                                                <a
                                                    href={getExplorerLink(txStatus.hash)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.txLink}
                                                >
                                                    View on BaseScan
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    <div className={styles.buttonGroup}>
                                        <button
                                            className={`${styles.mintButton} ${isMinting ? styles.minting : ''}`}
                                            onClick={handleMintScore}
                                            disabled={isMinting || txStatus?.status === 'mining'}
                                        >
                                            {getMintButtonText()}
                                        </button>
                                        <button
                                            className={styles.playAgainButton}
                                            onClick={handlePlayAgain}
                                        >
                                            Play Again
                                        </button>
                                    </div>
                                </>
                            )}

                            {!showNameInput && (
                                <div className={styles.leaderboard}>
                                    <h2>Top Scores</h2>
                                    <div className={styles.leaderboardList}>
                                        {leaderboard.map((entry, index) => (
                                            <div key={index} className={styles.leaderboardEntry}>
                                                <span className={styles.rank}>#{index + 1}</span>
                                                <span className={styles.name}>{entry.name}</span>
                                                <span className={styles.score}>{entry.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {isConnected && !showNameInput && (
                                <div className={styles.walletInfo}>
                                    <p>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
                                    <button
                                        className={styles.disconnectButton}
                                        onClick={handleDisconnect}
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameContainer; 