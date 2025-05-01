import React, { useState } from 'react';
import Image from 'next/image';
import styles from './GameContainer.module.css';
import { NewChatBox } from '../Chat/NewChatBox';
import { useInventory } from '../../contexts/InventoryContext';
import inventoryStyles from '../../styles/Inventory.module.css';
import { Category, ItemCategory, SubCategory } from '../../types/inventory';
import { LayeredCharacter } from '../Character/LayeredCharacter';

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

// Add LoadingSpinner component
const LoadingSpinner: React.FC = () => (
    <div className={inventoryStyles.loadingWrapper}>
        <div className={inventoryStyles.loadingSpinner}>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        </div>
    </div>
);


type EquippedItems = {
    body: string | null;
    eyes: string | null;
    fur: string | null;
    head: string | null;
    minipet: string | null;
    misc: string | null;
    mouth: string | null;
    nose: string | null;
    skin: string | null;
    powerups: string | null;
};

export const InventoryScreen: React.FC<{ onBackToMenu: () => void }> = ({ onBackToMenu }) => {
    const {
        items,
        itemCounts,
        getItemsByCategory,
        countItem,
        isLoading,
        equippedItems,
        equipItem
    } = useInventory();

    const [selectedCategory, setSelectedCategory] = useState<Category>('outfits');
    const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | 'all'>('all');
    const [isEquipping, setIsEquipping] = useState(false);

    const handleButtonClick = (callback: () => void) => {
        playSound(buttonClickSound);
        callback();
    };

    const handleBackToMenu = () => {
        handleButtonClick(onBackToMenu);
    };

    const handleEquipItem = async (slot: SubCategory, itemId: string | null) => {
        playSound(buttonClickSound);
        setIsEquipping(true);
        
        try {
            if (itemId) {
                await equipItem(itemId, slot, true);
            } else {
                const currentEquipped = equippedItems[slot];
                if (currentEquipped) {
                    await equipItem(currentEquipped, slot, false);
                }
            }
        } catch (error) {
            console.error(`Error equipping ${slot} item:`, error);
        } finally {
            setIsEquipping(false);
        }
    };

    const renderCharacterPreview = () => (
        <div className={inventoryStyles.characterPreview}>
            <div className={inventoryStyles.characterModel}>
                <LayeredCharacter 
                    width={200} 
                    height={200} 
                    showShadow={true}
                    equippedMinipet={
                        equippedItems.minipet === 'baldeagle' ? 'Baldeagle' :
                        equippedItems.minipet === 'bug' ? 'Bug' :
                        equippedItems.minipet === 'devil' ? 'Devil' :
                        equippedItems.minipet === 'dodo' ? 'Dodo' :
                        equippedItems.minipet === 'donkey' ? 'Donkey' :
                        equippedItems.minipet === 'elephant' ? 'Elephant' :
                        equippedItems.minipet === 'falcon' ? 'Falcon' :
                        equippedItems.minipet === 'octopus' ? 'Octopus' :
                        equippedItems.minipet === 'owl' ? 'Owl' :
                        equippedItems.minipet === 'phoenix' ? 'Phoenix' :
                        equippedItems.minipet === 'pig' ? 'Pig' :
                        equippedItems.minipet === 'polar_bear' ? 'Polar Bear' :
                        equippedItems.minipet === 'puffin' ? 'Puffin' :
                        equippedItems.minipet === 'reaper' ? 'Reaper' :
                        equippedItems.minipet === 'red_parrot' ? 'Red Parrot' :
                        equippedItems.minipet === 'robot' ? 'Robot' :
                        equippedItems.minipet === 'snake' ? 'Snake' :
                        equippedItems.minipet === 'turkey' ? 'Turkey' :
                        equippedItems.minipet === 'turtle' ? 'Turtle' :
                        equippedItems.minipet === 'walrus' ? 'Walrus' :
                        equippedItems.minipet === 'witch' ? 'Witch' :
                        equippedItems.minipet === 'zombie_bird' ? 'Zombie Bird' :
                        null
                    }
                    equippedHead={
                        equippedItems.head === 'musketeer' ? 'Musketeer' :
                        equippedItems.head === 'bandage' ? 'Bandage' :
                        equippedItems.head === 'brown_hat' ? 'Brown_hat' :
                        equippedItems.head === 'halo' ? 'Halo' :
                        equippedItems.head === 'bow' ? 'Bow' :
                        equippedItems.head === 'toga' ? 'Toga' :
                        null
                    }
                    equippedMouth={
                        equippedItems.mouth === 'haha' ? 'Haha' :
                        equippedItems.mouth === 'smileysnug' ? 'SmileySnug' :
                        equippedItems.mouth === 'pout' ? 'Pout' :
                        equippedItems.mouth === 'tinytooth' ? 'TinyTooth' :
                        equippedItems.mouth === 'chomp' ? 'Chomp' :
                        null
                    }
                    equippedEyes={
                        equippedItems.eyes === 'swag' ? 'Swag' :
                        equippedItems.eyes === 'coolglass' ? 'CoolGlass' :
                        equippedItems.eyes === 'grumpy' ? 'Grumpy' :
                        equippedItems.eyes === 'sparklyeyes' ? 'SparklyEyes' :
                        equippedItems.eyes === 'dizzy' ? 'dizzy' :
                        equippedItems.eyes === 'huh' ? 'Huh' :
                        equippedItems.eyes === 'bored' ? 'Bored' :
                        equippedItems.eyes === 'innocent' ? 'Innocent' :
                        null
                    }
                    equippedNose={
                        equippedItems.nose === 'clownnose' ? 'ClownNose' :
                        null
                    }
                />
            </div>
        </div>
    );

    const renderItemGrid = (items: any[], category: SubCategory) => (
        <div className={inventoryStyles.itemGrid}>
            <div 
                className={`${inventoryStyles.itemCard} ${!equippedItems[category] ? inventoryStyles.selected : ''}`}
                onClick={() => handleEquipItem(category, null)}
            >
                <div className={inventoryStyles.noItem}></div>
            </div>
            {isLoading || isEquipping ? (
                <div className={inventoryStyles.loadingContainer}>
                    <LoadingSpinner />
                </div>
            ) : items.map((item) => (
                <div 
                    key={item.id} 
                    className={`${inventoryStyles.itemCard} ${equippedItems[item.subCategory as SubCategory] === item.id ? inventoryStyles.selected : ''}`}
                    onClick={() => handleEquipItem(item.subCategory as SubCategory, item.id)}
                    data-rarity={item.rarity}
                >
                    <div 
                        className={inventoryStyles.itemImage}
                        style={item.color ? { background: item.color } : undefined}
                    >
                        {item.imageUrl ? (
                            <Image 
                                src={item.subCategory === 'head' || item.subCategory === 'mouth' || item.subCategory === 'eyes' || item.subCategory === 'nose'? item.imageUrl.replace('.png', '_preview.png') : item.imageUrl} 
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

    const renderInventoryContent = () => {
        if (selectedCategory === 'outfits') {
            if (selectedSubCategory !== 'all') {
                const categoryTitles: { [key: string]: string } = {
                    body: 'Body Items',
                    eyes: 'Eyes',
                    fur: 'Fur Styles',
                    head: 'Head Items',
                    minipet: 'Mini Pets',
                    misc: 'Misc Items',
                    mouth: 'Mouth Items',
                    nose: 'Nose Items',
                    skin: 'Skins',
                    speed: 'Speed',
                    jump: 'Jump',
                    shield: 'Shield'
                };

                return (
                    <div className={inventoryStyles.inventoryContent}>
                        <div className={inventoryStyles.categorySection}>
                            <h3 className={inventoryStyles.categoryTitle}>
                                {categoryTitles[selectedSubCategory as SubCategory]}
                            </h3>
                            {renderItemGrid(
                                getItemsByCategory(selectedSubCategory as ItemCategory),
                                selectedSubCategory === 'speed' || selectedSubCategory === 'jump' || selectedSubCategory === 'shield' 
                                    ? selectedSubCategory as SubCategory
                                    : selectedSubCategory as SubCategory
                            )}
                        </div>
                    </div>
                );
            }

            const allItems = [
                ...getItemsByCategory('body'),
                ...getItemsByCategory('eyes'),
                ...getItemsByCategory('fur'),
                ...getItemsByCategory('head'),
                ...getItemsByCategory('minipet'),
                ...getItemsByCategory('misc'),
                ...getItemsByCategory('mouth'),
                ...getItemsByCategory('nose'),
                ...getItemsByCategory('skin')
            ];

            return (
                <div className={inventoryStyles.inventoryContent}>
                    <div className={inventoryStyles.categorySection}>
                        <h3 className={inventoryStyles.categoryTitle}>All Items</h3>
                        {renderItemGrid(allItems, 'skin' as SubCategory)}
                    </div>
                </div>
            );
        }

        return (
            <div className={inventoryStyles.inventoryContent}>
                <div className={inventoryStyles.categorySection}>
                    <h3 className={inventoryStyles.categoryTitle}>Powerups</h3>
                    {renderItemGrid([
                        ...getItemsByCategory('speed'),
                        ...getItemsByCategory('jump'),
                        ...getItemsByCategory('shield')
                    ], 'speed' as SubCategory)}
                </div>
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
                <div className={inventoryStyles.categoryButtons}>
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.all}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('all');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.skin}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('skin');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.fur}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('fur');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.body}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('body');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.heads}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('head');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.eyes}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('eyes');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.nose}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('nose');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.mouth}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('mouth');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.minipets}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('minipet');
                        }}
                    />
                    <div 
                        className={`${inventoryStyles.categoryButton} ${inventoryStyles.misc}`} 
                        onClick={() => {
                            playSound(buttonClickSound);
                            setSelectedCategory('outfits');
                            setSelectedSubCategory('misc');
                        }}
                    />
                </div>
                <div className={inventoryStyles.itemsContainer}>
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
        <NewChatBox 
            walletAddress={walletAddress} 
            username={username} 
            onBackToMenu={onBackToMenu}
        />
    );
};

interface InstructionsScreenProps {
    onStartGame: () => void;
    onBackToMenu: () => void;
}

export const InstructionsScreen: React.FC<InstructionsScreenProps> = ({ 
    onStartGame,
    onBackToMenu
}) => {
    const handleButtonClick = (callback: () => void) => {
        playSound(buttonClickSound);
        callback();
    };

    return (
        <div className={styles.instructionsContainer}>
            <div className={styles.instructionsImageWrapper}>
                <Image 
                    src="/assets/Instructions.svg"
                    alt="Game Instructions"
                    width={800}
                    height={600}
                    priority
                />
            </div>

            <div className={styles.instructionsButtons}>
                <button 
                    className={styles.primaryButton} 
                    onClick={() => handleButtonClick(onStartGame)}
                    onMouseEnter={() => playSound(buttonHoverSound)}
                >
                    OK
                </button>
            </div>
        </div>
    );
};