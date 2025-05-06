import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './GameContainer.module.css';
import { NewChatBox } from '../Chat/NewChatBox';
import { useInventory } from '../../contexts/InventoryContext';
import inventoryStyles from '../../styles/Inventory.module.css';
import { Category, ItemCategory, SubCategory } from '../../types/inventory';
import { LayeredCharacter } from '../Character/LayeredCharacter';

// Add button sounds at the top
const buttonHoverSound = typeof window !== 'undefined' ? new Audio('/assets/audio/btnhover.mp3') : null;
const buttonClickSound = typeof window !== 'undefined' ? new Audio('/assets/audio/btnclick.mp3') : null;

// Helper function to play sounds (Updated to accept isMuted)
const playSound = (sound: HTMLAudioElement | null, isMuted: boolean) => {
    if (!isMuted && sound) { // Check isMuted
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

// Animation variants for inventory item cards
const itemCardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
};

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

// --- Update InventoryScreen props ---
interface InventoryScreenProps {
    onBackToMenu: () => void;
    isMuted: boolean; // <-- Add isMuted prop
}
// --- End Update ---

export const InventoryScreen: React.FC<InventoryScreenProps> = ({ onBackToMenu, isMuted }) => { // <-- Add isMuted to props
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
        playSound(buttonClickSound, isMuted); // <-- Pass isMuted
        callback();
    };

    const handleBackToMenu = () => {
        handleButtonClick(onBackToMenu);
    };

    const handleEquipItem = async (slot: SubCategory, itemId: string | null) => {
        playSound(buttonClickSound, isMuted); // <-- Pass isMuted
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
            <AnimatePresence>
                {isLoading || isEquipping ? (
                    <motion.div 
                        key="loading-indicator"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={inventoryStyles.loadingContainer}
                    >
                        <LoadingSpinner />
                    </motion.div>
                ) : items.map((item) => (
                    <motion.div
                        key={item.id} 
                        layout
                        variants={itemCardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.15 }}
                        whileHover={{ scale: 1.08, transition: { duration: 0.1 } }}
                        className={`${inventoryStyles.itemCard} ${equippedItems[item.subCategory as SubCategory] === item.id ? inventoryStyles.selected : ''}`}
                        onClick={() => handleEquipItem(item.subCategory as SubCategory, item.id)}
                        data-rarity={item.rarity}
                        onContextMenu={(e) => e.preventDefault()}
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
                    </motion.div>
                ))}
            </AnimatePresence>
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
                            <motion.h3 
                                className={inventoryStyles.categoryTitle}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.25 }}
                            >
                                {categoryTitles[selectedSubCategory as SubCategory]}
                            </motion.h3>
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
                        <motion.h3 
                            className={inventoryStyles.categoryTitle}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.25 }}
                        >
                            All Items
                        </motion.h3>
                        {renderItemGrid(allItems, 'skin' as SubCategory)}
                    </div>
                </div>
            );
        }

        return (
            <div className={inventoryStyles.inventoryContent}>
                <div className={inventoryStyles.categorySection}>
                    <motion.h3 
                        className={inventoryStyles.categoryTitle}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.25 }}
                    >
                        Powerups
                    </motion.h3>
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
        <motion.div 
            className={inventoryStyles.inventoryContainer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onContextMenu={(e) => e.preventDefault()}
        >
            <motion.div 
                className={inventoryStyles.header}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
            >
                <h1 className={inventoryStyles.title}>Inventory</h1>
                <button
                    onClick={handleBackToMenu}
                    onMouseEnter={() => playSound(buttonHoverSound, isMuted)}
                    className={inventoryStyles.backButton}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    Back to Menu
                </button>
            </motion.div>
            <div className={inventoryStyles.mainContent}>
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    {renderCharacterPreview()}
                </motion.div>
                <div className={inventoryStyles.categoryButtons}>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.all}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('all');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.15 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.skin}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('skin');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.2 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.fur}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('fur');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.25 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.body}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('body');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.3 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.heads}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('head');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.35 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.eyes}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('eyes');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.4 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.nose}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('nose');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.45 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.mouth}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('mouth');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.5 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.minipets}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('minipet');
                            }}
                        />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.55 }}
                    >
                        <div 
                            className={`${inventoryStyles.categoryButton} ${inventoryStyles.misc}`} 
                            onClick={() => {
                                playSound(buttonClickSound, isMuted);
                                setSelectedCategory('outfits');
                                setSelectedSubCategory('misc');
                            }}
                        />
                    </motion.div>
                </div>
                <motion.div 
                    className={inventoryStyles.itemsContainer}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                >
                    {renderInventoryContent()}
                </motion.div>
            </div>
        </motion.div>
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
        if (buttonClickSound) {
            buttonClickSound.currentTime = 0;
            buttonClickSound.play().catch(e => console.log(e));
        }
        callback();
    };

    return (
        <div className={styles.multiplayerContainer}>

            <NewChatBox 
                walletAddress={walletAddress}
                username={username}
                onBackToMenu={onBackToMenu}
            />
        </div>
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
        if (buttonClickSound) {
            buttonClickSound.currentTime = 0;
            buttonClickSound.play().catch(e => console.log(e));
        }
        callback();
    };

    return (
        <motion.div 
            className={styles.instructionsContainer}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
        >
            <h2>How to Play</h2>
            <div className={styles.instructionsContent}>
                <p><strong>Objective:</strong> Travel as far as you can while collecting coins and avoiding obstacles!</p>
                
                <h4>Controls:</h4>
                <ul>
                    <li><strong>Jump:</strong> Space Bar / Tap Screen</li>
                    <li><strong>Move Left:</strong> Left Arrow / 'A' Key / Swipe Left (when grounded)</li>
                    <li><strong>Move Right:</strong> Right Arrow / 'D' Key / Swipe Right (when grounded)</li>
                    <li><strong>Directional Jump:</strong> Move Left/Right + Jump for a boosted jump in that direction!</li>
                </ul>

                <h4>Gameplay:</h4>
                <ul>
                    <li>Your <strong>Jump Bar</strong> depletes over time. Keep it filled by jumping on boxes or collecting power-ups!</li>
                    <li><strong>Box Jumps:</strong> Landing on boxes gives you XP and replenishes your Jump Bar. Chain them for combos!</li>
                    <li><strong>Power-ups:</strong> Collect Moyakis for special abilities like Triple Jump, 2x Score, Coin Magnet, and Time Warp (resets Jump Bar).</li>
                    <li><strong>Coins:</strong> Gather coins to spend in the Shop.</li>
                </ul>

                <h4>Tips:</h4>
                <ul>
                    <li>Master the directional jump to clear large gaps.</li>
                    <li>Watch your Jump Bar! Don't let it run out.</li>
                    <li>Connect your wallet to save progress, earn achievements, and compete on the leaderboard!</li>
                </ul>
            </div>
            <div className={styles.instructionsActions}>
                 <button 
                    className={styles.secondaryButton} 
                    onClick={() => handleButtonClick(onBackToMenu)}
                    onMouseEnter={() => { if(buttonHoverSound) { buttonHoverSound.currentTime=0; buttonHoverSound.play().catch(e=>console.log(e)); }}}
                >
                    Back to Menu
                </button>
                 <button 
                    className={styles.primaryButton} 
                    onClick={() => handleButtonClick(onStartGame)}
                    onMouseEnter={() => { if(buttonHoverSound) { buttonHoverSound.currentTime=0; buttonHoverSound.play().catch(e=>console.log(e)); }}}
                >
                    OK
                </button>
            </div>
        </motion.div>
    );
};