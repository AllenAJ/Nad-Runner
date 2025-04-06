import React, { useState } from 'react';
import Image from 'next/image';
import styles from './GameContainer.module.css';
import { ChatBox } from '../Chat/ChatBox';
import { useInventory } from '../../contexts/InventoryContext';
import inventoryStyles from '../../styles/Inventory.module.css';
import { Category, ItemCategory } from '../../types/inventory';



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


export const ShopScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    const handleButtonClick = (callback: () => void) => {
        playSound(buttonClickSound);
        callback();
    };

    return (
        <div className={styles.shopScreen}>
            <h2>Shop</h2>
            <p>Coming soon...</p>
            <button 
                onClick={() => handleButtonClick(onBackToMenu)}
                onMouseEnter={() => playSound(buttonHoverSound)}
                className={styles.backButton}
            >
                Back to Menu
            </button>
        </div>
    );
};

type EquippedItems = {
    head: string | null;
    eyes: string | null;
    mouth: string | null;
    hands: string | null;
    feet: string | null;
    skin: string | null;
};

export const InventoryScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    const {
        items,
        itemCounts,
        getItemsByCategory,
        countItem,
        isLoading
    } = useInventory();

    const [selectedCategory, setSelectedCategory] = useState<Category>('outfits');
    const [equippedItems, setEquippedItems] = useState<EquippedItems>({
        head: null,
        eyes: null,
        mouth: null,
        hands: null,
        feet: null,
        skin: null
    });

    const handleButtonClick = (callback: () => void) => {
        playSound(buttonClickSound);
        callback();
    };

    const handleBackToMenu = () => {
        handleButtonClick(onBackToMenu);
    };

    const handleEquipItem = (slot: keyof EquippedItems, itemId: string | null) => {
        playSound(buttonClickSound);
        setEquippedItems(prev => ({
            ...prev,
            [slot]: itemId
        }));
    };

    const renderCharacterPreview = () => (
        <div className={inventoryStyles.characterPreview}>
            <div className={inventoryStyles.characterModel}>
                <Image 
                    src="/assets/mainchar.svg"
                    alt="Character"
                    width={150}
                    height={150}
                    priority
                />
            </div>
        </div>
    );

    const renderItemGrid = (items: any[], category: keyof EquippedItems) => (
        <div className={inventoryStyles.itemGrid}>
            <div 
                className={`${inventoryStyles.itemCard} ${!equippedItems[category] ? inventoryStyles.selected : ''}`}
                onClick={() => handleEquipItem(category, null)}
            >
                <div className={inventoryStyles.itemImage}>
                    <div className={inventoryStyles.noItem}></div>
                </div>
            </div>
            {isLoading ? (
                <div className={inventoryStyles.loadingContainer}>
                    Loading items...
                </div>
            ) : items.map((item) => (
                <div 
                    key={item.id} 
                    className={`${inventoryStyles.itemCard} ${equippedItems[category] === item.id ? inventoryStyles.selected : ''}`}
                    onClick={() => handleEquipItem(category, item.id)}
                >
                    <div 
                        className={inventoryStyles.itemImage}
                        style={item.color ? { background: item.color } : undefined}
                    >
                        {item.imageUrl ? (
                            <Image 
                                src={item.imageUrl} 
                                alt={item.name} 
                                width={32} 
                                height={32}
                                layout="responsive"
                            />
                        ) : (
                            <div className={inventoryStyles.placeholder}>{item.name.substring(0, 2)}</div>
                        )}
                    </div>
                    {countItem(item.id) > 1 && (
                        <div className={inventoryStyles.itemCount}>x{countItem(item.id)}</div>
                    )}
                    <div className={`${inventoryStyles.rarityIndicator} ${inventoryStyles[item.rarity]}`} />
                </div>
            ))}
        </div>
    );

    const renderCategorySection = (category: keyof EquippedItems, items: any[]) => (
        <div className={inventoryStyles.categorySection}>
            <h3 className={inventoryStyles.categoryTitle}>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
            {renderItemGrid(items, category)}
        </div>
    );

    const renderInventoryContent = () => {
        const categories = ['head', 'eyes', 'mouth', 'hands', 'feet'];
        return (
            <div className={inventoryStyles.inventoryContent}>
                {categories.map(category => 
                    renderCategorySection(
                        category as keyof EquippedItems,
                        getItemsByCategory(category as ItemCategory)
                    )
                )}
            </div>
        );
    };

    return (
        <div className={inventoryStyles.inventoryContainer}>
            <div className={inventoryStyles.header}>
                <h1 className={inventoryStyles.title}>Inventory</h1>
                <button
                    onClick={handleBackToMenu}
                    onMouseEnter={() => playSound(buttonHoverSound)}
                    className={inventoryStyles.backButton}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    Back to Menu
                </button>
            </div>
            <div className={inventoryStyles.mainContent}>
                {renderCharacterPreview()}
                <div className={inventoryStyles.itemsContainer}>
                    <div className={inventoryStyles.skinSection}>
                        <h2 className={inventoryStyles.sectionTitle}>Skins</h2>
                        {renderItemGrid(getItemsByCategory('skin'), 'skin')}
                    </div>
                    {renderInventoryContent()}
                </div>
            </div>
        </div>
    );
};

interface MultiplayerScreenProps {
    onBackToMenu: () => void;
    walletAddress: string;
    username: string;
}

export const MultiplayerScreen: React.FC<MultiplayerScreenProps> = ({ 
    onBackToMenu,
    walletAddress,
    username
}) => {
    const handleButtonClick = (callback: () => void) => {
        playSound(buttonClickSound);
        callback();
    };

    return (
        <div className={styles.multiplayerScreen}>
            <div className={styles.chatSection}>
                <ChatBox 
                    walletAddress={walletAddress} 
                    username={username} 
                    onBackToMenu={onBackToMenu}
                />
            </div>
            <button 
                onClick={() => handleButtonClick(onBackToMenu)}
                onMouseEnter={() => playSound(buttonHoverSound)}
                className={styles.backButton}
            >
                Back to Menu
            </button>
        </div>
    );
};