import React from 'react';
import Image from 'next/image';
import styles from './GameContainer.module.css';

interface MainMenuProps {
    leaderboard: Array<{name: string, score: number}>;
    onStartGame: () => void;
    onNavigateTo: (screen: 'multiplayer' | 'shop' | 'inventory') => void;
    isConnected: boolean;
    onConnect: () => void;
    walletAddress: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
    leaderboard, 
    onStartGame, 
    onNavigateTo,
    isConnected,
    onConnect,
    walletAddress
}) => {
    // Format the wallet address for display
    const formatWalletAddress = (address: string) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <div className={styles.menuContainer}>
            <div className={styles.mainMenuLayout}>
                <div className={styles.characterSection}>
                    <div className={styles.characterWrapper}>
                        <Image 
                            src="/assets/molandak.png" 
                            alt="Molandak character" 
                            width={200}
                            height={200}
                            className={styles.mainMenuCharacter}
                            priority
                        />
                    </div>
                    {isConnected && (
                        <div className={styles.walletAddressUnderCharacter}>
                            <div className={styles.walletIndicator}></div>
                            <span className={styles.walletAddressText}>
                                {formatWalletAddress(walletAddress)}
                            </span>
                        </div>
                    )}
                </div>
                
                <div className={styles.menuActionSection}>
                    {isConnected ? (
                        <div className={styles.menuButtonsContainer}>
                            <button onClick={onStartGame} className={styles.primaryButton}>
                                PLAY
                            </button>
                            
                            <div className={styles.secondaryMenuButtons}>
                                <button onClick={() => onNavigateTo('multiplayer')} className={styles.menuButton}>
                                    MULTIPLAYER
                                </button>
                                <button onClick={() => onNavigateTo('shop')} className={styles.menuButton}>
                                    SHOP
                                </button>
                                <button onClick={() => onNavigateTo('inventory')} className={styles.menuButton}>
                                    INVENTORY
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.walletConnectionSection}>
                            <div className={styles.walletRequiredMessage}>
                                <Image 
                                    src="/assets/molandak.png" 
                                    alt="Molandak" 
                                    width={40} 
                                    height={40} 
                                    className={styles.miniCharacter}
                                />
                                <p>Please connect your wallet to play NadRunner</p>
                            </div>
                            <button onClick={onConnect} className={styles.primaryButton}>
                                CONNECT WALLET
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {leaderboard.length > 0 && (
                <div className={styles.leaderboardSection}>
                    <h3>TOP PLAYERS</h3>
                    <div className={styles.leaderboardContent}>
                        {leaderboard.slice(0, 10).map((entry, index) => (
                            <div key={index} className={styles.leaderboardEntry}>
                                <span className={styles.rank}>#{index + 1}</span>
                                <span className={styles.name}>{entry.name}</span>
                                <span className={styles.score}>{Math.floor(entry.score)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isConnected && (
                <div className={styles.walletControls}>
                    <button onClick={onConnect} className={styles.disconnectButton}>
                        Disconnect Wallet
                    </button>
                </div>
            )}
        </div>
    );
};