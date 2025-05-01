// src/components/Shop.tsx
import React, { useState, useEffect, useCallback } from 'react';
import styles from './Shop.module.css';
import { LayeredCharacter } from '../../components/Character/LayeredCharacter';
import inventoryStyles from '../../styles/Inventory.module.css';
import Image from 'next/image';

// Add button sounds
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

// Reuse the ShopItem type, maybe move to a shared types file later
interface ShopItem {
    id: string;
    name: string;
    description: string;
    category: string;
    sub_category: string;
    rarity: string;
    price: number;
    image_url: string;
    preview_url: string;
    color?: string;
    type: 'normal' | 'premium';
    owned: boolean;
}

interface ShopProps {
    walletAddress: string | null; // Pass the logged-in user's wallet address
    onClose?: () => void; // Optional callback to close the shop modal/view
    updateCoins?: (newBalance: number) => void; // Callback to update coin display elsewhere
}

interface PreviewState {
    background?: string;
    character?: string;
    effect?: string;
    head?: string;
    mouth?: string;
    eyes?: string;
    nose?: string;
    minipet?: string;
}

type PurchaseStatus = {
    [key: string]: 'idle' | 'buying' | 'success' | 'error';
};

const CoinIcon = () => (
    <Image 
        src="/Display_Icon/coin.svg" 
        alt="Coin" 
        width={20} 
        height={20}
        style={{ marginLeft: '4px' }}
    />
);

const DiamondIcon = () => (
    <Image 
        src="/Display_Icon/diamond.svg" 
        alt="Diamond" 
        width={20} 
        height={20}
        style={{ marginLeft: '4px' }}
    />
);

const Shop: React.FC<ShopProps> = ({ walletAddress, onClose, updateCoins }) => {
    const [activeTab] = useState<'normal' | 'premium'>('normal');
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [purchaseStatus, setPurchaseStatus] = useState<PurchaseStatus>({});
    const [previewState, setPreviewState] = useState<PreviewState>({});

    const fetchItems = useCallback(async () => {
        if (!walletAddress) {
            setError("Please connect your wallet to view the shop.");
            setItems([]);
            return;
        }

        setLoading(true);
        setError(null);
        setPurchaseStatus({});

        try {
            const response = await fetch(
                `/api/shop/items?section=normal`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${walletAddress.trim()}`,
                    'X-Request-Timestamp': Date.now().toString()
                }
            });

            if (!response.ok) {
                let errorData: { message?: string } = {}; // Give errorData a potential type
                try {
                    errorData = await response.json();
                } catch (e) {
                    console.error("Failed to parse error response JSON");
                }
                throw new Error(errorData.message || `Failed to load items (${response.status})`);
            }

            const data = await response.json();
            console.log("Raw data from /api/shop/items:", data); // Log raw data

            // Validate the response data
            if (!Array.isArray(data)) {
                throw new Error('Invalid response format from server');
            }

            // Validate each item in the response
            const validatedItems = data.filter((item): item is ShopItem => {
                const isValid = (
                    typeof item === 'object' &&
                    item !== null &&
                    typeof item.id === 'string' &&
                    typeof item.name === 'string' &&
                    typeof item.price === 'number' &&
                    typeof item.type === 'string' &&
                    (item.type === 'normal' || item.type === 'premium') &&
                    typeof item.rarity === 'string' &&
                    typeof item.owned === 'boolean'
                );

                return isValid;
            });

            console.log('Fetched items with quantities:', validatedItems);
            setItems(validatedItems);
        } catch (e) {
            console.error("Failed to fetch shop items:", e);
            setError(e instanceof Error ? e.message : "Failed to load items.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]); // Only depends on walletAddress now

    const handleBuyItem = async (item: ShopItem) => {
        // Early validation for wallet address
        if (!walletAddress || walletAddress.trim() === '') {
            setError("Please connect your wallet to make a purchase");
            return;
        }

        console.log('Attempting to buy item:', item);

        // Double check item exists in current state
        const currentItem = items.find(i => i.id === item.id);
        if (!currentItem) {
            setError("Item not found in shop");
            return;
        }

        if (purchaseStatus[item.id] === 'buying') {
            return;
        }

        // Prevent buying premium items
        if (item.type === 'premium') {
            setError("Premium items will be available soon!");
            setTimeout(() => setError(null), 3000);
            return;
        }
        
        // Ensure we only proceed if the item type matches the active tab
        if (item.type !== activeTab) { 
            return;
        }

        setPurchaseStatus(prev => ({
            ...prev,
            [item.id]: 'buying'
        }));
        setError(null);
        setSuccessMessage(null);

        try {
            const endpoint = item.type === 'normal' ? '/api/shop/buy-normal' : '/api/shop/buy-premium';
            
            // Prepare request headers
            const headers = new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${walletAddress.trim()}`,
                'X-Request-Time': Date.now().toString()
            });

            const requestBody = {
                itemId: item.id,
                walletAddress: walletAddress.trim(),
                timestamp: Date.now(),
                section: activeTab
            };

            console.log('Sending purchase request:', {
                endpoint,
                headers: Object.fromEntries(headers.entries()),
                body: requestBody
            });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
                credentials: 'include'
            });

            let result;
            try {
                result = await response.json();
                console.log('Purchase response:', result);
            } catch (e) {
                throw new Error('Invalid server response');
            }

            if (!response.ok) {
                const errorMessage = result?.message || result?.error || `Purchase failed (${response.status})`;
                console.error("Server response (error):", result);
                throw new Error(errorMessage);
            }

            // Validate the purchase response
            if (!result || typeof result.success !== 'boolean' || !result.success) {
                throw new Error(result?.message || 'Purchase validation failed');
            }

            // Show success message
            setSuccessMessage(`Successfully purchased ${item.name}!`);

            // Play purchase sound
            playSound(buttonClickSound);

            setPurchaseStatus(prev => ({
                ...prev,
                [item.id]: 'success'
            }));

            // Update the items list to mark as owned
            setItems(prevItems => 
                prevItems.map(i => 
                    i.id === item.id 
                        ? { ...i, owned: true } 
                        : i
                )
            );

            // Update coin balance if callback provided
            if (updateCoins && typeof result.newCoinBalance === 'number') {
                updateCoins(result.newCoinBalance);
            }

            // Clear success status after delay
            setTimeout(() => {
                setPurchaseStatus(prev => {
                    const newStatus = { ...prev };
                    delete newStatus[item.id];
                    return newStatus;
                });
                
                // Clear success message
                setTimeout(() => {
                    setSuccessMessage(null);
                }, 2000);
            }, 1000);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Purchase failed";
            console.error("Failed to purchase item:", errorMessage);
            setError(errorMessage);
            setPurchaseStatus(prev => ({
                ...prev,
                [item.id]: 'error'
            }));

            // Clear error status after delay
            setTimeout(() => {
                setPurchaseStatus(prev => {
                    const newStatus = { ...prev };
                    delete newStatus[item.id];
                    return newStatus;
                });
                setError(null);
            }, 3000);
        }
    };

    const getPreviewImageUrl = (imageUrl: string) => {
        return imageUrl.replace('.png', '_preview.png');
    };

    const filteredItems = items.filter(item => 
        activeTab === 'normal' ? item.type === 'normal' : item.type === 'premium'
    );

    const handlePreviewItem = (item: ShopItem) => {
        if (!walletAddress) return; // Prevent preview if wallet disconnected
        setPreviewState(prev => {
            const isCurrentlyPreviewing = prev[item.sub_category as keyof PreviewState] === item.id;
            if (isCurrentlyPreviewing) {
                // Remove preview
                const newState = { ...prev };
                delete newState[item.sub_category as keyof PreviewState];
                return newState;
            } else {
                // Set new preview
                return {
                    ...prev,
                    [item.sub_category]: item.id
                };
            }
        });
    };

    const handleBackToMenu = () => {
        playSound(buttonClickSound);
        if (onClose) onClose();
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Shop</h1>
                {onClose && (
                    <button 
                        className={styles.backButton}
                        onClick={handleBackToMenu}
                        onMouseEnter={() => playSound(buttonHoverSound)}
                    >
                        Back to Menu
                    </button>
                )}
            </div>

            <div className={styles.mainContent}>
                {/* Left Section - Character Preview */}
                <div className={styles.leftSection}>
                    <div className={styles.characterPreview}>
                        <LayeredCharacter
                            width={200}
                            height={200}
                            showShadow={true}
                            equippedHead={previewState.head}
                            equippedMouth={previewState.mouth}
                            equippedEyes={previewState.eyes}
                            equippedNose={previewState.nose}
                            equippedMinipet={previewState.minipet}
                        />
                        <div className={styles.characterControls}>
                            <button className={styles.controlButton}>
                                <Image 
                                    src="/ShopUI/accessoriesCircleLeftButton.png" 
                                    alt="Rotate Left" 
                                    width={40} 
                                    height={40}
                                />
                            </button>
                            <button className={styles.controlButton}>
                                <Image 
                                    src="/ShopUI/accessoriesResetButton.png" 
                                    alt="Reset View" 
                                    width={40} 
                                    height={40}
                                />
                            </button>
                            <button className={styles.controlButton}>
                                <Image 
                                    src="/ShopUI/accessoriesCircleRightButton.png" 
                                    alt="Rotate Right" 
                                    width={40} 
                                    height={40}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Center Section - Category Buttons */}
                <div className={styles.categoryButtons}>
                    <button
                        className={`${styles.tabButton} ${activeTab === 'normal' ? styles.active : ''}`}
                        onClick={() => { /* No action needed, always normal */ }}
                    >
                        <Image 
                            src={activeTab === 'normal' ? '/ShopUI/normalItemButton_hover.svg' : '/ShopUI/normalItemButton.svg'}
                            alt="Normal Items"
                            width={182}
                            height={86}
                            priority
                        />
                    </button>
                    <button
                        className={`${styles.tabButton} ${styles.disabledTab}`}
                        onClick={() => setError("Premium items will be available soon!")}
                        disabled
                    >
                        <Image 
                            src={'/ShopUI/premiumItemButton.svg'}
                            alt="Premium Items (Coming Soon)"
                            width={182}
                            height={86}
                            priority
                        />
                    </button>
                </div>

                {/* Right Section - Shop Items */}
                <div className={styles.rightSection}>
                    {error && <div className={styles.error}>{error}</div>}
                    {successMessage && <div className={styles.success}>{successMessage}</div>}

                    {loading ? (
                        <div className={styles.loadingWrapper}>
                            <div className={styles.loadingSpinner}>
                                <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.itemsGrid}>
                            {filteredItems.map((item) => (
                                <div key={item.id} className={styles.itemContainer}>
                                    <div
                                        className={`${styles.itemCard} ${previewState[item.sub_category as keyof PreviewState] === item.id ? styles.previewActive : ''}`}
                                        data-rarity={item.rarity}
                                        onClick={() => handlePreviewItem(item)}
                                    >
                                        <div className={styles.itemImage}>
                                            <img
                                                src={getPreviewImageUrl(item.image_url)}
                                                alt={item.name}
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className={styles.itemDetails}>
                                        <div className={styles.itemName}>{item.name}</div>
                                        <div className={styles.itemDescription}>{item.description}</div>
                                        
                                        <div className={styles.itemPrice}>
                                            {item.price} {item.type === 'normal' ? <CoinIcon /> : <DiamondIcon />}
                                        </div>
                                    </div>
                                    
                                    <div className={styles.itemActions}>
                                        {item.owned && <div className={styles.ownedLabel}>Owned</div>}
                                        <div className={styles.buttonContainer}>
                                            <button
                                                className={styles.tryButton}
                                                onClick={() => handlePreviewItem(item)}
                                                disabled={!walletAddress}
                                            >
                                                <Image 
                                                    src="/ShopUI/tryButton.svg"
                                                    alt="Try"
                                                    width={80}
                                                    height={40}
                                                 />
                                            </button>
                                            <button
                                                className={styles.buyButton}
                                                onClick={() => handleBuyItem(item)}
                                                disabled={!walletAddress || purchaseStatus[item.id] === 'buying'}
                                            >
                                                <Image 
                                                    src="/ShopUI/buyButton.svg"
                                                    alt={purchaseStatus[item.id] === 'buying' ? 'Buying...' : 'Buy'}
                                                    width={80}
                                                    height={40}
                                                 />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Shop; 