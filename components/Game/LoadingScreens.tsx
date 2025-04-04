import React, { useState, useEffect } from 'react';
import styles from './GameContainer.module.css';

interface LoadingScreenProps { 
    loadingProgress: number;
    leaderboardLoaded: boolean;
    isConnected: boolean;
    onConnect: () => Promise<void>;
    assetsLoaded: boolean;
    onAssetsLoaded: () => void;
    walletAddress?: string;
    onPlayerDataLoaded?: (data: any) => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
    loadingProgress, 
    leaderboardLoaded,
    isConnected,
    onConnect,
    assetsLoaded,
    onAssetsLoaded,
    walletAddress,
    onPlayerDataLoaded
}) => {
    const [loadingMessage, setLoadingMessage] = useState("Checking wallet...");
    const [playerDataLoaded, setPlayerDataLoaded] = useState(false);
    
    useEffect(() => {
        async function loadPlayerData() {
            if (isConnected && walletAddress && !playerDataLoaded) {
                try {
                    setLoadingMessage("Loading player data...");
                    const response = await fetch(`/api/user/data?walletAddress=${walletAddress}`);
                    if (response.status === 404) {
                        // User doesn't exist yet, this is expected for new users
                        setLoadingMessage("Welcome! Please create a username to continue.");
                        if (onPlayerDataLoaded) {
                            onPlayerDataLoaded(null);
                        }
                        setPlayerDataLoaded(true);
                    } else if (!response.ok) {
                        throw new Error('Failed to fetch player data');
                    } else {
                        const data = await response.json();
                        if (onPlayerDataLoaded) {
                            onPlayerDataLoaded(data);
                        }
                        setPlayerDataLoaded(true);
                    }
                } catch (error) {
                    console.error('Error loading player data:', error);
                    setLoadingMessage("Error loading player data. Please try again.");
                }
            }
        }

        loadPlayerData();
    }, [isConnected, walletAddress, playerDataLoaded, onPlayerDataLoaded]);
    
    useEffect(() => {
        if (isConnected) {
            if (!playerDataLoaded) {
                setLoadingMessage("Loading player data...");
            } else if (!leaderboardLoaded) {
                setLoadingMessage("Loading leaderboard...");
            } else if (!assetsLoaded) {
                setLoadingMessage("Loading game assets...");
            } else {
                setLoadingMessage("Starting game...");
                const timer = setTimeout(onAssetsLoaded, 1000);
                return () => clearTimeout(timer);
            }
        }
    }, [isConnected, playerDataLoaded, leaderboardLoaded, assetsLoaded, onAssetsLoaded]);

    return (
        <div className={styles.loadingScreenContainer}>
            <div className={styles.loadingBackground}>
                <img 
                    src="/assets/loading.svg" 
                    alt="Loading background" 
                    className={styles.loadingBackgroundImage}
                />
            </div>

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