import React, { useState } from 'react';
import styles from './NewChatBox.module.css';

interface Item {
    id: string;
    name: string;
    imageUrl: string;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

interface TradeOffer {
    id: string;
    sellerName: string;
    sellerAddress: string;
    item: Item;
    timestamp: string;
}

interface TradeSectionProps {
    walletAddress: string;
    username: string;
    onlineUsers: string[];
}

export const TradeSection: React.FC<TradeSectionProps> = ({
    walletAddress,
    username,
    onlineUsers
}) => {
    const [isSelectingItem, setIsSelectingItem] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [offers, setOffers] = useState<TradeOffer[]>([]);

    // Mock items - replace with actual inventory items
    const mockItems: Item[] = [
        { id: '1', name: 'Halo', imageUrl: '/assets/items/halo.png', rarity: 'legendary' },
        { id: '2', name: 'Cool Glass', imageUrl: '/assets/items/coolglass.png', rarity: 'epic' },
        { id: '3', name: 'Bow', imageUrl: '/assets/items/bow.png', rarity: 'rare' },
    ];

    const handleMakeOffer = () => {
        setIsSelectingItem(true);
    };

    const handleSelectItem = (item: Item) => {
        setSelectedItem(item);
        setIsSelectingItem(false);
        
        // Create new offer
        const newOffer: TradeOffer = {
            id: `offer-${Date.now()}`,
            sellerName: username,
            sellerAddress: walletAddress,
            item: item,
            timestamp: new Date().toISOString()
        };
        
        setOffers(prev => [newOffer, ...prev]);
    };

    const handleCancelOffer = (offerId: string) => {
        setOffers(prev => prev.filter(offer => offer.id !== offerId));
    };

    return (
        <div className={styles.tradeSection}>
            <div className={styles.marketHeader}>
                <h3>MARKETPLACE</h3>
                <button 
                    className={styles.makeOfferButton}
                    onClick={handleMakeOffer}
                >
                    Make Offer
                </button>
            </div>

            {isSelectingItem ? (
                <div className={styles.itemSelectionGrid}>
                    <div className={styles.gridHeader}>
                        <h4>Select an item to offer</h4>
                        <button 
                            className={styles.closeButton}
                            onClick={() => setIsSelectingItem(false)}
                        >
                            ×
                        </button>
                    </div>
                    <div className={styles.itemsGrid}>
                        {mockItems.map(item => (
                            <div 
                                key={item.id}
                                className={styles.itemCard}
                                onClick={() => handleSelectItem(item)}
                            >
                                <div className={styles.itemImage}>
                                    <img src={item.imageUrl} alt={item.name} />
                                </div>
                                <div className={styles.itemInfo}>
                                    <span className={styles.itemName}>{item.name}</span>
                                    <span className={`${styles.itemRarity} ${styles[item.rarity || '']}`}>
                                        {item.rarity}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={styles.offersContainer}>
                    {offers.map(offer => (
                        <div key={offer.id} className={styles.offerCard}>
                            <div className={styles.offerHeader}>
                                <span className={styles.sellerName}>{offer.sellerName}</span>
                                {offer.sellerAddress === walletAddress && (
                                    <button 
                                        className={styles.cancelOfferButton}
                                        onClick={() => handleCancelOffer(offer.id)}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                            <div className={styles.offeredItem}>
                                <div className={styles.itemImage}>
                                    <img src={offer.item.imageUrl} alt={offer.item.name} />
                                </div>
                                <div className={styles.itemInfo}>
                                    <span className={styles.itemName}>{offer.item.name}</span>
                                    <span className={`${styles.itemRarity} ${styles[offer.item.rarity || '']}`}>
                                        {offer.item.rarity}
                                    </span>
                                </div>
                                {offer.sellerAddress !== walletAddress && (
                                    <button className={styles.tradeButton}>
                                        Trade
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {offers.length === 0 && (
                        <div className={styles.noOffers}>
                            No active offers. Make an offer to start trading!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}; 