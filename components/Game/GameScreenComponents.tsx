import React, { useState } from 'react';
import Image from 'next/image';
import styles from './GameContainer.module.css';

// Inventory data with customization options
const customizationData = {
    character: {
        skins: [
            { id: 'default', color: '#FFFFFF', name: 'Default' },
            { id: 'red', color: '#FF0000', name: 'Red' },
            { id: 'blue', color: '#0000FF', name: 'Blue' },
            { id: 'green', color: '#00FF00', name: 'Green' },
            { id: 'purple', color: '#800080', name: 'Purple' },
            { id: 'yellow', color: '#FFFF00', name: 'Yellow' }
        ]
    },
    backgrounds: [
        { id: 'default', name: 'Default Sky', color: '#87CEEB' },
        { id: 'sunset', name: 'Sunset', color: '#FF7F50' },
        { id: 'night', name: 'Night', color: '#191970' },
        { id: 'forest', name: 'Forest', color: '#228B22' }
    ],
    accessories: {
        hats: [
            { id: 'none', name: 'No Hat', icon: '❌' },
            { id: 'baseball', name: 'Baseball Cap', icon: '🧢' },
            { id: 'crown', name: 'Crown', icon: '👑' },
            { id: 'beanie', name: 'Beanie', icon: '🧶' }
        ],
        eyes: [
            { id: 'default', name: 'Default', icon: '👀' },
            { id: 'cool', name: 'Cool Shades', icon: '😎' },
            { id: 'glasses', name: 'Nerd Glasses', icon: '🤓' }
        ]
    }
};

export const CustomizationScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    const [selectedSkin, setSelectedSkin] = useState('default');
    const [selectedBackground, setSelectedBackground] = useState('default');
    const [selectedHat, setSelectedHat] = useState('none');
    const [selectedEyes, setSelectedEyes] = useState('default');

    return (
        <div className={styles.customizationContainer}>
            <div className={styles.customizationHeader}>
                <h2>Customize Your Character</h2>
                <button onClick={onBackToMenu} className={styles.closeButton}>
                    ✖
                </button>
            </div>

            <div className={styles.customizationContent}>
                <div className={styles.characterPreview}>
                    <Image 
                        src="/assets/molandak.png" 
                        alt="Character Preview" 
                        width={200} 
                        height={200} 
                        style={{ 
                            backgroundColor: customizationData.character.skins.find(s => s.id === selectedSkin)?.color 
                        }}
                    />
                </div>

                <div className={styles.customizationOptions}>
                    <div className={styles.customizationSection}>
                        <h3>Character Skin</h3>
                        <div className={styles.optionsGrid}>
                            {customizationData.character.skins.map((skin) => (
                                <button 
                                    key={skin.id}
                                    className={`${styles.customizationItem} ${selectedSkin === skin.id ? styles.selected : ''}`}
                                    style={{ backgroundColor: skin.color }}
                                    onClick={() => setSelectedSkin(skin.id)}
                                >
                                    {skin.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.customizationSection}>
                        <h3>Background</h3>
                        <div className={styles.optionsGrid}>
                            {customizationData.backgrounds.map((bg) => (
                                <button 
                                    key={bg.id}
                                    className={`${styles.customizationItem} ${selectedBackground === bg.id ? styles.selected : ''}`}
                                    style={{ backgroundColor: bg.color }}
                                    onClick={() => setSelectedBackground(bg.id)}
                                >
                                    {bg.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.customizationSection}>
                        <h3>Hat</h3>
                        <div className={styles.optionsGrid}>
                            {customizationData.accessories.hats.map((hat) => (
                                <button 
                                    key={hat.id}
                                    className={`${styles.customizationItem} ${selectedHat === hat.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedHat(hat.id)}
                                >
                                    {hat.icon} {hat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.customizationSection}>
                        <h3>Eyes</h3>
                        <div className={styles.optionsGrid}>
                            {customizationData.accessories.eyes.map((eye) => (
                                <button 
                                    key={eye.id}
                                    className={`${styles.customizationItem} ${selectedEyes === eye.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedEyes(eye.id)}
                                >
                                    {eye.icon} {eye.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.customizationFooter}>
                <button className={styles.saveButton}>
                    Save Customization
                </button>
            </div>
        </div>
    );
};

// Update other screens to use the new Customization screen
export const ShopScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    return (
        <div className={styles.menuContainer}>
            <h2>Shop</h2>
            <p>Coming soon! Buy upgrades and customizations.</p>
            <button onClick={onBackToMenu} className={styles.menuButton}>
                Back to Menu
            </button>
        </div>
    );
};

export const InventoryScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    return (
        <CustomizationScreen onBackToMenu={onBackToMenu} />
    );
};

export const MultiplayerScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    return (
        <div className={styles.menuContainer}>
            <h2>Multiplayer</h2>
            <p>Challenge your friends! Coming soon.</p>
            <button onClick={onBackToMenu} className={styles.menuButton}>
                Back to Menu
            </button>
        </div>
    );
};