import React from 'react';
import { ethers } from 'ethers';
import { TransactionStatus } from '../../utils/web3';
import styles from './GameContainer.module.css';

interface GameOverProps {
    score: number;
    hasEnteredName: boolean;
    playerName: string;
    isConnected: boolean;
    isMinting: boolean;
    mintStatus: TransactionStatus | null;
    onPlayerNameChange: (name: string) => void;
    onNameSubmit: () => void;
    onConnect: () => void;
    onMintScore: () => void;
    onPlayAgain: () => void;
    onBackToMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverProps> = ({
    score,
    hasEnteredName,
    playerName,
    isConnected,
    isMinting,
    mintStatus,
    onPlayerNameChange,
    onNameSubmit,
    onConnect,
    onMintScore,
    onPlayAgain,
    onBackToMenu
}) => {
    return (
        <div className={styles.gameOverContainer}>
            <h2>Game Over!</h2>
            <p>Score: {Math.floor(score)}</p>
            
            {!hasEnteredName ? (
                <>
                    <input
                        type="text"
                        placeholder="Enter your name"
                        value={playerName}
                        onChange={(e) => onPlayerNameChange(e.target.value)}
                    />
                    <button onClick={onNameSubmit}>Submit Score</button>
                </>
            ) : (
                <>
                    <button onClick={onConnect}>
                        {isConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
                    </button>
                    <button
                        onClick={onMintScore}
                        disabled={isMinting || !isConnected}
                    >
                        {isMinting ? 'Minting...' : 'Mint Score'}
                    </button>
                    {mintStatus && (
                        <div className={`${styles.mintStatus} ${styles[mintStatus.status]}`}>
                            <p>{mintStatus.message}</p>
                            {mintStatus.status === 'error' &&
                                mintStatus.message.includes('foul play') && (
                                    <p className={styles.errorDetails}>
                                        Please play the game normally.
                                    </p>
                                )}
                            {mintStatus.hash && (
                                <a
                                    href={`https://testnet.monadexplorer.com/tx/${mintStatus.hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.txLink}
                                >
                                    View Transaction
                                </a>
                            )}
                        </div>
                    )}
                    <button onClick={onPlayAgain}>
                        Play Again
                    </button>
                    <button onClick={onBackToMenu}>
                        Back to Menu
                    </button>
                </>
            )}
        </div>
    );
};