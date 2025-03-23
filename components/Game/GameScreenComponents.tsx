import React from 'react';
import styles from './GameContainer.module.css';

export const ShopScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => (
    <div className={styles.menuContainer}>
        <h2>Shop</h2>
        <p>Coming soon! Buy upgrades and customizations.</p>
        <button onClick={onBackToMenu} className={styles.menuButton}>
            Back to Menu
        </button>
    </div>
);

export const InventoryScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => (
    <div className={styles.menuContainer}>
        <h2>Inventory</h2>
        <p>Your items and collectibles will appear here.</p>
        <button onClick={onBackToMenu} className={styles.menuButton}>
            Back to Menu
        </button>
    </div>
);

export const MultiplayerScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => (
    <div className={styles.menuContainer}>
        <h2>Multiplayer</h2>
        <p>Challenge your friends! Coming soon.</p>
        <button onClick={onBackToMenu} className={styles.menuButton}>
            Back to Menu
        </button>
    </div>
);