import React from 'react';
import styles from './GameContainer.module.css';

export const LoadingScreen: React.FC<{ 
    loadingProgress: number; 
    leaderboardLoaded: boolean 
}> = ({ loadingProgress, leaderboardLoaded }) => {
    return (
        <div 
            className={styles.gameWrapper} 
            style={{ 
                width: '100%', 
                height: '100%' 
            }}
        >
            <div className={styles.menuContainer}>
                <div className={styles.versionLabel}>beta 1.9</div>
                
                <div className={styles.loadingCharacter}>
                    <img 
                        src="/assets/molandak.png" 
                        alt="Molandak loading" 
                        className={styles.spinningCharacter} 
                    />
                </div>
                                    
                <div className={styles.loadingBar}>
                    <div 
                        className={styles.loadingProgress} 
                        style={{width: `${loadingProgress}%`}}
                    ></div>
                </div>
                
                <div className={styles.loadingText}>
                    {leaderboardLoaded 
                        ? 'Loading game assets...' 
                        : 'Loading leaderboard...'}
                </div>
            </div>
        </div>
    );
};