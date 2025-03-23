import React from 'react';
import styles from './GameContainer.module.css';

interface MainMenuProps {
    leaderboard: Array<{name: string, score: number}>;
    onStartGame: () => void;
    onNavigateTo: (screen: 'multiplayer' | 'shop' | 'inventory') => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
    leaderboard, 
    onStartGame, 
    onNavigateTo 
}) => {
    return (
        <div className={styles.menuContainer}>
            <div className={styles.mainButtons}>
                <button onClick={onStartGame} className={styles.primaryButton}>
                    PLAY
                </button>
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

            {leaderboard.length > 0 && (
                <div className={styles.leaderboard}>
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
    );
};