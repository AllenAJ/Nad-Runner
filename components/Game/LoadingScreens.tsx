import React, { useState, useEffect } from 'react';
import styles from './GameContainer.module.css';

interface LoadingScreenProps { 
    loadingProgress: number;
    leaderboardLoaded: boolean;
    isConnected: boolean;
    onConnect: () => Promise<void>;
    assetsLoaded: boolean;
    onAssetsLoaded: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
    loadingProgress, 
    leaderboardLoaded,
    isConnected,
    onConnect,
    assetsLoaded,
    onAssetsLoaded
}) => {
    const [loadingMessage, setLoadingMessage] = useState("Checking wallet...");
    
    useEffect(() => {
        if (isConnected) {
            if (!leaderboardLoaded) {
                setLoadingMessage("Loading leaderboard...");
            } else if (!assetsLoaded) {
                setLoadingMessage("Loading game assets...");
            } else {
                setLoadingMessage("Starting game...");
                // Trigger the transition to main menu
                const timer = setTimeout(onAssetsLoaded, 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [isConnected, leaderboardLoaded, assetsLoaded, onAssetsLoaded]);

    return (
        <div className={styles.loadingContainer} style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            width: '100%', 
            height: '100%' 
        }}>
            <div className={styles.versionLabel}>beta 1.9</div>

            {!isConnected ? (
                // Wallet connection screen (centered and prominent)
                <div className={styles.walletConnectionContainer}>
                    <div className={styles.characterContainer}>
                        <img 
                            src="/assets/welcome.gif" 
                            alt="Molandak character" 
                            className={styles.characterImage}
                        />
                    </div>
                    
                    <h2 className={styles.connectionTitle}>
                        Welcome to NadRunner!
                    </h2>
                    
                    <p className={styles.connectionMessage}>
                        Connect your wallet to start playing
                    </p>
                    
                    <button 
                        onClick={onConnect} 
                        className={styles.connectWalletButton}
                    >
                        Connect Wallet
                    </button>
                </div>
            ) : (
                // Regular loading screen when wallet is connected
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingCharacter}>
                        <img 
                            src="/assets/juggle.gif" 
                            alt="Molandak loading" 
                            className={styles.loadingCharacter} 
                        />
                    </div>
                    
                    <div className={styles.loadingBar}>
                        <div 
                            className={styles.loadingProgress} 
                            style={{width: `${loadingProgress}%`}}
                        ></div>
                    </div>
                    
                    <div className={styles.loadingText}>
                        {loadingMessage}
                    </div>
                </div>
            )}
        </div>
    );
};