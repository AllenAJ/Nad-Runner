import React, { useState } from 'react';
import Image from 'next/image';
import styles from './GameContainer.module.css';
import { Alert } from './Alert';
import { UsernamePrompt } from './UsernamePrompt';
import { LayeredCharacter } from '../Character/LayeredCharacter';
import { useInventory } from '../../contexts/InventoryContext';

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

// Add button sounds at the top
const buttonHoverSound = typeof window !== 'undefined' ? new Audio('/assets/audio/btnhover.mp3') : null;
const buttonClickSound = typeof window !== 'undefined' ? new Audio('/assets/audio/btnclick.mp3') : null;

// Helper function to play sounds
const playSound = (sound: HTMLAudioElement | null) => {
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => {
            console.log('Sound playback failed:', error);
        });
    }
};

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
    const { reloadInventory } = useInventory();
    const [isInventoryLoading, setIsInventoryLoading] = useState(false);
    const [alert, setAlert] = React.useState<{
        show: boolean;
        message: string;
        type?: 'info' | 'warning' | 'error';
    }>({ show: false, message: '' });
    const [showShopPopup, setShowShopPopup] = useState(false);

    // State for button interactions
    const [isPetsHovering, setIsPetsHovering] = useState(false);
    const [isPetsActive, setIsPetsActive] = useState(false);
    const [isAccessoriesHovering, setIsAccessoriesHovering] = useState(false);
    const [isAccessoriesActive, setIsAccessoriesActive] = useState(false);

    const handleMultiplayerClick = () => {
        onNavigateTo('multiplayer');
    };

    const handleShopButtonClick = () => {
        playSound(buttonClickSound);
        setShowShopPopup(true);
    };

    const handleAccessoriesClick = () => {
        playSound(buttonClickSound);
        setShowShopPopup(false);
        onNavigateTo('shop');
    };

    const handlePetsClick = () => {
        playSound(buttonClickSound);
        // TODO: Implement Pets navigation or functionality
        console.log("Pets button clicked - functionality TBD");
        setShowShopPopup(false);
    };

    const handleInventoryClick = async () => {
        playSound(buttonClickSound);
        setIsInventoryLoading(true);
        try {
            await reloadInventory();
            onNavigateTo('inventory');
        } finally {
            setIsInventoryLoading(false);
        }
    };

    // Format the wallet address for display
    const formatWalletAddress = (address: string) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    const handleButtonClick = (callback: () => void) => {
        playSound(buttonClickSound);
        callback();
    };

    // Function to determine image source based on state
    const getButtonImageSrc = (buttonType: 'pets' | 'accessories') => {
        if (buttonType === 'pets') {
            if (isPetsActive) return '/ShopUI/petButton_hover.png';
            if (isPetsHovering) return '/ShopUI/petButton_hover.png';
            return '/ShopUI/petButton.png';
        } else { // accessories
            // Using hover state for active as no specific down image provided
            if (isAccessoriesActive || isAccessoriesHovering) return '/ShopUI/accessoriesButton_hover.png'; 
            return '/ShopUI/accessoriesButton.png';
        }
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
                        <LayeredCharacter 
                            width={120}
                            height={120}
                            className={styles.mainMenuCharacter}
                        />
                        <div className={styles.characterShadow} />
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
                    {isNewUser ? (
                        <UsernamePrompt onSubmit={onUsernameSubmit} />
                    ) : (
                        <>
                            <button
                                className={styles.primaryButton}
                                onClick={() => handleButtonClick(onStartGame)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected}
                            >
                                PLAY
                            </button>
                            <button
                                className={styles.menuButton}
                                onClick={handleShopButtonClick}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected}
                            >
                                SHOP
                            </button>
                            <button
                                className={styles.menuButton}
                                onClick={handleInventoryClick}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected || isInventoryLoading}
                            >
                                {isInventoryLoading ? 'LOADING...' : 'INVENTORY'}
                            </button>
                            <button
                                className={styles.menuButton}
                                onClick={() => handleButtonClick(handleMultiplayerClick)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected}
                            >
                                MULTIPLAYER
                            </button>
                            {/* <button
                                className={styles.connectButton}
                                onClick={() => handleButtonClick(onConnect)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                            >
                                {isConnected ? `Connected: ${formatWalletAddress(walletAddress)}` : 'Connect Wallet'}
                            </button> */}
                        </>
                    )}
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

            {/* Shop Options Popup */}
            {showShopPopup && isConnected && (
                <div className={styles.shopPopupOverlay}>
                    <div className={styles.shopPopupContainer}>
                        <button 
                            className={styles.shopPopupCloseButton} 
                            onClick={() => setShowShopPopup(false)}
                            onMouseEnter={() => playSound(buttonHoverSound)}
                        >X</button>
                        <button 
                            className={styles.shopOptionButton} 
                            onClick={handlePetsClick}
                            onMouseEnter={() => { setIsPetsHovering(true); playSound(buttonHoverSound); }}
                            onMouseLeave={() => { setIsPetsHovering(false); setIsPetsActive(false); }}
                            onMouseDown={() => setIsPetsActive(true)}
                            onMouseUp={() => setIsPetsActive(false)}
                        >
                            <Image 
                                key={getButtonImageSrc('pets')}
                                src={getButtonImageSrc('pets')}
                                alt="Pets" 
                                width={304} 
                                height={118}
                                priority
                            />
                        </button>
                        <button 
                            className={styles.shopOptionButton} 
                            onClick={handleAccessoriesClick}
                            onMouseEnter={() => { setIsAccessoriesHovering(true); playSound(buttonHoverSound); }}
                            onMouseLeave={() => { setIsAccessoriesHovering(false); setIsAccessoriesActive(false); }}
                            onMouseDown={() => setIsAccessoriesActive(true)}
                            onMouseUp={() => setIsAccessoriesActive(false)}
                        >
                            <Image 
                                key={getButtonImageSrc('accessories')}
                                src={getButtonImageSrc('accessories')}
                                alt="Accessories" 
                                width={314} 
                                height={118}
                                priority
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};