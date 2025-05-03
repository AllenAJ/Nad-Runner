import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './GameContainer.module.css';
import { Alert } from './Alert';
import { UsernamePrompt } from './UsernamePrompt';
import { LayeredCharacter } from '../Character/LayeredCharacter';
import { useInventory } from '../../contexts/InventoryContext';
import AchievementsPopup from '../Achievements/AchievementsPopup';
import { ACHIEVEMENTS } from '../../constants/achievements';
import { preloadScreenAssets } from '../../utils/image-preloader';

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
        achievements_bitmap: string;
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

// Animation variants for overlays/popups
const overlayVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
};

// Variants for staggering main menu elements
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1 // Delay between children animating in
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 }, // Start faded out and slightly down
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } } // Fade in and slide up
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
        username: '',
        achievements_bitmap: '0'
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
    const [showAchievements, setShowAchievements] = useState(false);

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

    const handleAchievementsClick = () => {
        playSound(buttonClickSound);
        setShowAchievements(true);
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
            if (isPetsActive) return '/ShopUI/petButton_down.svg';
            if (isPetsHovering) return '/ShopUI/petButton_down.svg';
            return '/ShopUI/petButton.svg';
        } else { // accessories
            // Using hover state for active as no specific down image provided
            if (isAccessoriesActive || isAccessoriesHovering) return '/ShopUI/accessoriesButton_hover.svg'; 
            return '/ShopUI/accessoriesButton.svg';
        }
    };

    if (isConnected && isNewUser) {
        return <UsernamePrompt onSubmit={onUsernameSubmit} />;
    }

    return (
        <motion.div
            className={styles.menuContainer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            // Prevent default right-click menu
            onContextMenu={(e) => e.preventDefault()}
        >
            {alert.show && (
                <Alert
                    message={alert.message}
                    type={alert.type}
                    onClose={() => setAlert({ show: false, message: '' })}
                />
            )}
            
            <motion.div
                className={styles.mainMenuLayout}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Left Column - Player Card - Apply container variants to section, item variants to children */}
                <motion.div 
                    className={styles.characterSection}
                    variants={containerVariants} // Use container variants to stagger children
                >
                    <motion.div variants={itemVariants} className={styles.characterWrapper}>
                        <LayeredCharacter 
                            width={120}
                            height={120}
                            className={styles.mainMenuCharacter}
                        />
                        <div className={styles.characterShadow} />
                    </motion.div>
                    <motion.div variants={itemVariants} className={styles.walletAddress}>
                        {formatWalletAddress(walletAddress)}
                    </motion.div>
                    <motion.h2 variants={itemVariants} className={styles.rankTitle}>
                        {playerStats.username}
                    </motion.h2>
                    <motion.div variants={itemVariants} className={styles.badges}>
                        <div className={styles.bonusBadge}>
                            {playerStats.status}
                        </div>
                    </motion.div>

                    <motion.div variants={itemVariants} className={styles.statsContainer}>
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
                    </motion.div>

                    <motion.div variants={itemVariants} className={styles.xpSection}>
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
                    </motion.div>

                    <motion.div variants={itemVariants} className={styles.infoBox}>
                        <Image 
                            src="/assets/salmonad.png" 
                            alt="Box" 
                            width={40} 
                            height={40}
                        />
                        <p>Earn XP and Coins by playing!</p>
                    </motion.div>
                </motion.div>

                {/* Middle Column - Buttons - Apply container variants to section, item variants to buttons */}
                <motion.div 
                    className={styles.menuActionSection}
                    variants={containerVariants} // Use container variants to stagger children
                >
                    {isNewUser ? (
                        // Assuming UsernamePrompt has its own animation or doesn't need staggering here
                        <UsernamePrompt onSubmit={onUsernameSubmit} /> 
                    ) : (
                        // Wrap buttons in a fragment or div if needed, apply variants to motion elements
                        <>
                            <motion.button // Apply item variants to each button
                                className={styles.primaryButton}
                                onClick={() => handleButtonClick(onStartGame)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected}
                                variants={itemVariants}
                            >
                                PLAY
                            </motion.button>
                            <motion.button // Apply item variants
                                className={styles.menuButton}
                                onClick={() => handleButtonClick(handleMultiplayerClick)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected}
                                variants={itemVariants}
                            >
                                MARKETPLACE
                            </motion.button>
                            <motion.button // Apply item variants
                                className={styles.menuButton}
                                onClick={handleShopButtonClick}
                                // Preload shop assets on hover
                                onMouseEnter={() => {
                                    playSound(buttonHoverSound);
                                    if (isConnected && walletAddress) {
                                        preloadScreenAssets('shop', walletAddress);
                                    }
                                }}
                                disabled={!isConnected}
                                variants={itemVariants}
                            >
                                SHOP
                            </motion.button>
                            <motion.button // Apply item variants
                                className={styles.menuButton}
                                onClick={handleInventoryClick}
                                // Preload inventory assets on hover
                                onMouseEnter={() => {
                                    playSound(buttonHoverSound);
                                    if (isConnected && walletAddress) {
                                        preloadScreenAssets('inventory', walletAddress);
                                    }
                                }}
                                disabled={!isConnected || isInventoryLoading}
                                variants={itemVariants}
                            >
                                {isInventoryLoading ? 'LOADING...' : 'INVENTORY'}
                            </motion.button>
                            <motion.button // Apply item variants
                                className={styles.menuButton}
                                onClick={() => handleButtonClick(handleAchievementsClick)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                disabled={!isConnected}
                                variants={itemVariants}
                            >
                                ACHIEVEMENTS
                            </motion.button>

                            <motion.button // Apply item variants
                                className={styles.connectButton}
                                onClick={() => handleButtonClick(onConnect)}
                                onMouseEnter={() => playSound(buttonHoverSound)}
                                variants={itemVariants}
                            >
                                {isConnected ? `Connected: ${formatWalletAddress(walletAddress)}` : 'Connect Wallet'}
                            </motion.button>
                        </>
                    )}
                </motion.div>

                {/* Right Column - Leaderboard - Apply item variants */}
                {leaderboard.length > 0 && (
                    <motion.div 
                        className={styles.leaderboardSection}
                        variants={itemVariants}
                    >
                        <h3>TOP PLAYERS</h3>
                        <motion.div
                            className={styles.leaderboardContent}
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                        >
                            {leaderboard.slice(0, 10).map((entry, index) => (
                                <motion.div
                                    key={index}
                                    className={styles.leaderboardEntry}
                                    variants={itemVariants}
                                >
                                    <span className={styles.rank}>#{index + 1}</span>
                                    <span className={styles.name}>{entry.name}</span>
                                    <span className={styles.score}>{Math.floor(entry.score)}</span>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                )}
            </motion.div>

            {/* Shop Popup - Animated */}
            <AnimatePresence>
                {showShopPopup && (
                    <motion.div
                        className={styles.shopPopupOverlay}
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2 }}
                    >
                        <div className={styles.shopPopupContent}>
                            <button 
                                className={styles.shopPopupCloseButton}
                                onClick={() => {
                                    playSound(buttonClickSound);
                                    setShowShopPopup(false);
                                }}
                            >
                                X
                            </button>
                            <div className={styles.shopPopupButtons}>
                                <button
                                    className={styles.shopCategoryButton}
                                    onMouseEnter={() => { playSound(buttonHoverSound); setIsAccessoriesHovering(true); }}
                                    onMouseLeave={() => setIsAccessoriesHovering(false)}
                                    onClick={handleAccessoriesClick}
                                >
                                    <Image 
                                        src={getButtonImageSrc('accessories')}
                                        alt="Accessories"
                                        width={200}
                                        height={100}
                                    />
                                </button>
                                <button
                                    className={styles.shopCategoryButton}
                                    onMouseEnter={() => { playSound(buttonHoverSound); setIsPetsHovering(true); }}
                                    onMouseLeave={() => setIsPetsHovering(false)}
                                    onClick={handlePetsClick}
                                >
                                    <Image 
                                        src={getButtonImageSrc('pets')}
                                        alt="Pets"
                                        width={200}
                                        height={100}
                                    />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Achievements Popup - Animated (animation handled internally) */}
            <AnimatePresence>
                {showAchievements && (
                    <AchievementsPopup 
                        onClose={() => {
                            playSound(buttonClickSound);
                            setShowAchievements(false);
                        }} 
                        achievements={ACHIEVEMENTS}
                        bitmap={BigInt(playerStats.achievements_bitmap || '0')}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};