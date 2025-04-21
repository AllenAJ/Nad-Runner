// src/components/Shop.tsx
import React, { useState, useEffect, useCallback } from 'react';
import styles from './Shop.module.css';

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

const Shop: React.FC<ShopProps> = ({ walletAddress, onClose, updateCoins }) => {
    const [activeTab, setActiveTab] = useState<'normal' | 'premium'>('normal');
    const [items, setItems] = useState<ShopItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [purchaseStatus, setPurchaseStatus] = useState<{ [itemId: string]: 'buying' | 'error' | 'success' | null }>({});

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
                `/api/shop/items?section=${encodeURIComponent(activeTab)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${walletAddress}`,
                    'X-Request-Timestamp': Date.now().toString()
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to load items (${response.status})`);
            }

            const data = await response.json();

            // Validate the response data
            if (!Array.isArray(data)) {
                throw new Error('Invalid response format from server');
            }

            // Validate each item in the response
            const validatedItems = data.filter((item): item is ShopItem => {
                return (
                    typeof item === 'object' &&
                    item !== null &&
                    typeof item.id === 'string' &&
                    typeof item.name === 'string' &&
                    typeof item.price === 'number' &&
                    typeof item.type === 'string' &&
                    (item.type === 'normal' || item.type === 'premium') &&
                    typeof item.rarity === 'string'
                );
            });

            setItems(validatedItems);
        } catch (e) {
            console.error("Failed to fetch shop items:", e);
            setError(e instanceof Error ? e.message : "Failed to load items.");
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab, walletAddress]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]); // Depends on activeTab and walletAddress

    const handleBuyItem = async (item: ShopItem) => {
        if (!walletAddress || item.owned || purchaseStatus[item.id] === 'buying' || item.type !== activeTab) {
            return;
        }

        setPurchaseStatus(prev => ({ ...prev, [item.id]: 'buying' }));
        setError(null);

        try {
            const endpoint = item.type === 'normal' ? '/api/shop/buy-normal' : '/api/shop/buy-premium';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${walletAddress}`
                },
                body: JSON.stringify({
                    itemId: item.id,
                    timestamp: Date.now(),
                    section: activeTab // Include section for additional validation
                }),
            });

            let result;
            try {
                result = await response.json();
            } catch (e) {
                throw new Error('Invalid server response');
            }

            if (!response.ok) {
                throw new Error(result.message || `Purchase failed (${response.status})`);
            }

            // Validate the purchase response
            if (typeof result.success !== 'boolean' || !result.success) {
                throw new Error(result.message || 'Purchase validation failed');
            }

            setPurchaseStatus(prev => ({ ...prev, [item.id]: 'success' }));
            
            // Update the items list by fetching fresh data
            await fetchItems();

            // Update coin balance if callback provided
            if (updateCoins && typeof result.newCoinBalance === 'number') {
                updateCoins(result.newCoinBalance);
            }

            // Reset purchase status after a delay
            setTimeout(() => {
                setPurchaseStatus(prev => ({ ...prev, [item.id]: null }));
            }, 2000);

        } catch (e) {
            console.error("Failed to purchase item:", e);
            setError(e instanceof Error ? e.message : "Purchase failed.");
            setPurchaseStatus(prev => ({ ...prev, [item.id]: 'error' }));
            
            setTimeout(() => {
                setPurchaseStatus(prev => ({ ...prev, [item.id]: null }));
            }, 3000);
        }
    };

    const getPreviewImageUrl = (imageUrl: string) => {
        return imageUrl.replace('.png', '_preview.png');
    };

    const filteredItems = items.filter(item => 
        activeTab === 'normal' ? item.type === 'normal' : item.type === 'premium'
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Shop</h1>
                {onClose && <button onClick={onClose}>Close</button>}
            </div>

            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tabButton} ${activeTab === 'normal' ? styles.active : ''}`}
                    onClick={() => setActiveTab('normal')}
                >
                    Normal Items
                </button>
                <button
                    className={`${styles.tabButton} ${activeTab === 'premium' ? styles.active : ''}`}
                    onClick={() => setActiveTab('premium')}
                >
                    Premium Items
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {loading ? (
                <div className={styles.loading}>Loading items...</div>
            ) : (
                <div className={styles.itemsGrid}>
                    {filteredItems.map((item) => (
                        <div key={item.id} className={styles.itemContainer}>
                            <div
                                className={styles.itemCard}
                                data-rarity={item.rarity}
                            >
                                <div 
                                    className={styles.itemImage}
                                >
                                    <img
                                        src={getPreviewImageUrl(item.image_url)}
                                        alt={item.name}
                                        width={32}
                                        height={32}
                                        loading="lazy"
                                    />
                                </div>
                                {item.owned && <div className={styles.itemCount}>x1</div>}
                            </div>
                            
                            <div className={styles.itemDetails}>
                                <div className={styles.itemName}>{item.name}</div>
                                <div className={styles.itemDescription}>{item.description}</div>
                                {!item.owned && (
                                    <>
                                        <div className={styles.itemPrice}>
                                            {item.price} {item.type === 'normal' ? '🪙' : '💎'}
                                        </div>
                                        <button
                                            className={styles.buyButton}
                                            onClick={() => handleBuyItem(item)}
                                            disabled={purchaseStatus[item.id] === 'buying'}
                                        >
                                            {purchaseStatus[item.id] === 'buying' ? 'Buying...' : 'Buy'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Shop; 