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
    nextUpdate?: {
        hours: number;
        minutes: number;
        seconds: number;
    };
    isNewUser?: boolean;
    onUsernameSubmit: (username: string) => Promise<void>;
    playerStats?: {
        highScore: number;
        boxJumps: number;
        highScoreBoxJumps: number;
        coins: number;
        rounds: number;
        level: number;
        xp: number;
        xpToNextLevel: number;
        status: string;
        username: string;
    };
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
    leaderboard, 
    onStartGame, 
    onNavigateTo,
    isConnected,
    onConnect,
    walletAddress,
    nextUpdate = { hours: 66, minutes: 43, seconds: 56 },
    isNewUser = false,
    onUsernameSubmit,
    playerStats = {
        highScore: 0,
        boxJumps: 0,
        highScoreBoxJumps: 0,
        coins: 0,
        rounds: 0,
        level: 1,
        xp: 0,
        xpToNextLevel: 150,
        status: 'Newbie',
        username: ''
    },
}) => {
    const [alert, setAlert] = React.useState<{
        show: boolean;
        message: string;
        type?: 'info' | 'warning' | 'error';
    }>({ show: false, message: '' });

    const handleMultiplayerClick = () => {
        onNavigateTo('multiplayer');
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
                    <h2 className={styles.rankTitle}>
                        {playerStats.username}
                    </h2>
                    <div className={styles.badges}>
                        <div className={styles.bonusBadge}>
                            {playerStats.status}
                        </div>
                    </div>

                    <div className={styles.statsContainer}>
                        <div className={styles.statRow}>
                            <span>High Score</span>
                            <span>{playerStats.highScore}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Total Box Jumps</span>
                            <span>{playerStats.boxJumps}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Best Run Jumps</span>
                            <span>{playerStats.highScoreBoxJumps}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Coins</span>
                            <span>{playerStats.coins}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Rounds</span>
                            <span>{playerStats.rounds}</span>
                        </div>
                        <div className={styles.statRow}>
                            <span>Level</span>
                            <span>{playerStats.level}</span>
                        </div>
                    </div>

                    <div className={styles.xpSection}>
                        <div className={styles.xpHeader}>
                            <span>XP</span>
                            <span className={styles.xpCount}>
                                {playerStats.xp}/{playerStats.xpToNextLevel}
                            </span>
                        </div>
                        <div className={styles.xpProgressBar}>
                            <div 
                                className={styles.xpProgress} 
                                style={{ width: `${(playerStats.xp / playerStats.xpToNextLevel) * 100}%` }}
                            />
                        </div>
                    </div>

                    <div className={styles.infoBox}>
                        <Image 
                            src="/assets/salmonad.png" 
                            alt="Box" 
                            width={40} 
                            height={40}
                        />
                        <p>Earn XP and Coins by playing!</p>
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