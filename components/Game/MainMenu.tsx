import React from 'react';
import Image from 'next/image';
import styles from './GameContainer.module.css';
import { Alert } from './Alert';
import { UsernamePrompt } from './UsernamePrompt';

interface MainMenuProps {
    leaderboard: Array<{name: string, score: number}>;
    onStartGame: () => void;
    onNavigateTo: (screen: 'multiplayer' | 'shop' | 'inventory') => void;
    isConnected: boolean;
    onConnect: () => void;
    walletAddress: string;
    playerRank?: 'Bronze' | 'Silver' | 'Gold';
    xp?: number;
    maxXp?: number;
    nextUpdate?: {
        hours: number;
        minutes: number;
        seconds: number;
    };
    isNewUser?: boolean;
    onUsernameSubmit: (username: string) => Promise<void>;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
    leaderboard, 
    onStartGame, 
    onNavigateTo,
    isConnected,
    onConnect,
    walletAddress,
    playerRank = 'Bronze',
    xp = 2024,
    maxXp = 10000,
    nextUpdate = { hours: 66, minutes: 43, seconds: 56 },
    isNewUser = false,
    onUsernameSubmit
}) => {
    const [alert, setAlert] = React.useState<{
        show: boolean;
        message: string;
        type?: 'info' | 'warning' | 'error';
    }>({ show: false, message: '' });

    const handleMultiplayerClick = () => {
        setAlert({
            show: true,
            message: 'Multiplayer mode coming soon!',
            type: 'info'
        });
    };

    const handleShopClick = () => {
        setAlert({
            show: true,
            message: 'Shop coming soon!',
            type: 'info'
        });
    };

    const handleInventoryClick = () => {
        setAlert({
            show: true,
            message: 'Inventory coming soon!',
            type: 'info'
        });
    };

    // Format the wallet address for display
    const formatWalletAddress = (address: string) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    if (isConnected && isNewUser) {
        return <UsernamePrompt onSubmit={onUsernameSubmit} />;
    }

    return (
        <div className={styles.menuContainer}>
            {alert.show && (
                <Alert
                    message={alert.message}
                    type={alert.type}
                    onClose={() => setAlert({ show: false, message: '' })}
                />
            )}
            
            <div className={styles.mainMenuLayout}>
                {/* Left Column - Player Card */}
                <div className={styles.characterSection}>
                    <div className={styles.characterWrapper}>
                        <Image 
                            src="/assets/molandak.png" 
                            alt="Molandak character" 
                            width={120}
                            height={120}
                            className={styles.mainMenuCharacter}
                            priority
                        />
                    </div>
                    <div className={styles.walletAddress}>
                        {formatWalletAddress(walletAddress)}
                    </div>
                    <h2 className={styles.rankTitle}>{playerRank} Tier</h2>
                    <div className={styles.badges}>
                        <div className={styles.bonusBadge}>
                            Bonus: 0%
                        </div>
                        <div className={styles.holderBadge}>
                            Pengu Holder
                        </div>
                    </div>
                    <div className={styles.xpSection}>
                        <div className={styles.xpHeader}>
                            <span>XP</span>
                            <span className={styles.xpCount}>{xp}/{maxXp}</span>
                        </div>
                        <div className={styles.xpProgressBar}>
                            <div 
                                className={styles.xpProgress} 
                                style={{ width: `${(xp / maxXp) * 100}%` }}
                            />
                        </div>
                    </div>
                    <div className={styles.nextUpdate}>
                        <span>Next XP Update in</span>
                        <div className={styles.updateTimer}>
                            <span className={styles.timeUnit}>{nextUpdate.hours}h</span>
                            <span className={styles.timeUnit}>{nextUpdate.minutes}m</span>
                            <span className={styles.timeUnit}>{nextUpdate.seconds}s</span>
                        </div>
                    </div>
                    <div className={styles.infoBox}>
                        <Image 
                            src="/assets/Box.png" 
                            alt="Box" 
                            width={40} 
                            height={40}
                        />
                        <p>Earn XP throughout the week by using Abstract, live streaming, and more!</p>
                    </div>
                </div>

                {/* Middle Column - Buttons */}
                <div className={styles.menuActionSection}>
                    <button onClick={onStartGame} className={styles.primaryButton}>
                        PLAY
                    </button>
                    <button onClick={handleMultiplayerClick} className={styles.menuButton}>
                        MULTIPLAYER
                    </button>
                    <button onClick={handleShopClick} className={styles.menuButton}>
                        SHOP
                    </button>
                    <button onClick={handleInventoryClick} className={styles.menuButton}>
                        INVENTORY
                    </button>
                </div>

                {/* Right Column - Leaderboard */}
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
            </div>
        </div>
    );
};