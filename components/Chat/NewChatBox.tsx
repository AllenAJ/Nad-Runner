import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './NewChatBox.module.css';
import { TradeSection } from './TradeSection';
import { useInventory } from '../../contexts/InventoryContext';
import { Item as InventoryItem, Rarity, SubCategory } from '../../types/inventory';
import { RARITY_COLORS, INITIAL_ITEMS } from '../../constants/inventory';

interface Item {
    id: string;
    name: string;
    imageUrl: string;
    rarity: Rarity;
    quantity: number;
    subCategory: SubCategory;
}

interface TradeOffer {
    id: string;
    sellerName: string;
    sellerAddress: string;
    item: Item;
    timestamp: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

interface ChatMessage {
    id: number | string;
    sender_address: string;
    sender_name: string;
    message: string;
    created_at: string;
    isSystem?: boolean;
}

interface ChatBoxProps {
    walletAddress: string;
    username: string;
    onBackToMenu: () => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001';
const MAX_MESSAGE_LENGTH = 500;
const RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

const chatSound = typeof window !== 'undefined' ? new Audio('/assets/audio/sendchatsound.mp3') : null;

const RARITY_FILTERS = [
    { id: 'normal', label: 'Normal' },
    { id: 'premium', label: 'Premium' },
    { id: 'rare', label: 'Rare' },
    { id: 'event_rare', label: 'Event' },
    { id: 'ultra_rare', label: 'Ultra' },
    { id: 'trade_cash', label: 'Trade' }
] as const;

const CATEGORY_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'head', label: 'Head' },
    { id: 'eyes', label: 'Eyes' },
    { id: 'nose', label: 'Nose' },
    { id: 'mouth', label: 'Mouth' },
    { id: 'minipet', label: 'Pets' },
    { id: 'skin', label: 'Skins' }
] as const;

export const NewChatBox: React.FC<ChatBoxProps> = ({ walletAddress, username, onBackToMenu }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket>();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [activeRarityFilter, setActiveRarityFilter] = useState('');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
    const [isSelectingItem, setIsSelectingItem] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [offers, setOffers] = useState<TradeOffer[]>([]);
    const { items = {} } = useInventory();
    const [isOfferActive, setIsOfferActive] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Item[]>([]);

    // Convert inventory items to the format we need, handling undefined case
    const availableItems: Item[] = React.useMemo(() => {
        // First get all items from INITIAL_ITEMS that are in the inventory
        const inventoryItemIds = Object.keys(items);
        
        return INITIAL_ITEMS
            .filter(item => {
                // Only include items that are in the inventory
                const count = items[item.id] || 0;
                return count > 0;
            })
            .map(item => ({
                id: item.id,
                name: item.name,
                imageUrl: item.imageUrl || `/assets/items/${item.id}.png`,
                rarity: item.rarity,
                quantity: items[item.id] || 0,
                subCategory: item.subCategory
            }));
    }, [items]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const generateTempId = useCallback(() => 
        `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
    []);

    const setupSocketListeners = useCallback(() => {
        if (!socketRef.current) return;

        socketRef.current.on('connect', () => {
            console.log('Connected to chat server');
            setIsConnected(true);
            socketRef.current?.emit('join', { walletAddress, username });
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected from chat server');
            setIsConnected(false);
        });

        socketRef.current.on('message', (message: ChatMessage) => {
            if (message.sender_address.toLowerCase() !== walletAddress.toLowerCase()) {
                setMessages(prev => [...prev, message]);
                scrollToBottom();
            }
        });

        socketRef.current.on('onlineUsers', (users: string[]) => {
            setOnlineUsers(users);
        });

        socketRef.current.on('error', (error: string) => {
            console.error('Socket error:', error);
        });
    }, [walletAddress, username, scrollToBottom]);

    useEffect(() => {
        socketRef.current = io(SOCKET_URL, {
            reconnection: true,
            reconnectionAttempts: RECONNECT_ATTEMPTS,
            reconnectionDelay: RECONNECT_DELAY,
            transports: ['websocket', 'polling'],
            timeout: 10000,
            forceNew: true
        });

        setupSocketListeners();

        return () => {
            socketRef.current?.disconnect();
        };
    }, [setupSocketListeners]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        // Add initial system message
        setMessages([
            {
                id: 'welcome',
                sender_address: 'system',
                sender_name: 'System',
                message: 'Welcome to the marketplace!',
                created_at: new Date().toISOString(),
                isSystem: true
            }
        ]);
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = newMessage.trim();
        
        if (!trimmedMessage || !isConnected) return;

        try {
            if (chatSound) {
                chatSound.currentTime = 0;
                await chatSound.play();
            }

            const tempMessage: ChatMessage = {
                id: generateTempId(),
                sender_address: walletAddress.toLowerCase(),
                sender_name: username,
                message: trimmedMessage,
                created_at: new Date().toISOString()
            };

            setMessages(prev => [...prev, tempMessage]);
            setNewMessage('');

            socketRef.current?.emit('message', {
                walletAddress: walletAddress.toLowerCase(),
                username,
                message: trimmedMessage,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleSelectItem = (item: Item) => {
        handleMakeOffer(item);
        setIsSelectingItem(false);
    };

    const handleMakeOffer = (selectedItem: Item) => {
        // Create new offer
        const newOffer: TradeOffer = {
            id: `offer-${Date.now()}`,
            sellerName: username,
            sellerAddress: walletAddress,
            item: selectedItem,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        // Emit the offer to the server
        socketRef.current?.emit('makeTradeOffer', newOffer);
        
        // Optimistically add to local state
        setOffers(prev => [newOffer, ...prev]);
    };

    const handleCancelOffer = (offerId: string) => {
        setOffers(prev => prev.filter(offer => offer.id !== offerId));
    };

    const handleCloseOffer = () => {
        setIsOfferActive(false);
        setSelectedItems([]);
    };

    const handleAcceptOffer = (offer: TradeOffer) => {
        // Implement the logic to accept the offer
        console.log('Accepting offer:', offer);
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.chatContainer}>
                {/* Marketplace Header */}
                <div className={styles.marketplaceHeader}>
                    <div className={styles.marketplaceTitle}>
                        <h1>MARKETPLACE Sector A</h1>
                        <span className={styles.unlimitedDeals}>(unlimited deals)</span>
                    </div>
                    <button className={styles.backButton} onClick={onBackToMenu}>
                        Back To Menu
                    </button>
                </div>

                {/* Main Content */}
                <div className={styles.mainContent}>
                    {/* Trading Area */}
                    <div className={styles.tradingArea}>
                        <h2 className={styles.offersHeader}>OFFERS</h2>
                        <div className={styles.itemsGrid}>
                            {offers.map(offer => (
                                <div key={offer.id} className={styles.offerCard}>
                                    <div className={styles.offerHeader}>
                                        <span className={styles.sellerName}>{offer.sellerName}</span>
                                        {offer.sellerAddress === walletAddress ? (
                                            <button 
                                                className={styles.cancelOfferButton}
                                                onClick={() => handleCancelOffer(offer.id)}
                                            >
                                                Cancel
                                            </button>
                                        ) : (
                                            <span className={styles.offerStatus}>
                                                Available for trade
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.offeredItem}>
                                        <div 
                                            className={`${styles.itemCard} ${offer.sellerAddress !== walletAddress ? styles.tradeable : ''}`}
                                            data-rarity={offer.item.rarity}
                                            onClick={() => {
                                                if (offer.sellerAddress !== walletAddress && offer.status === 'pending') {
                                                    handleAcceptOffer(offer);
                                                }
                                            }}
                                        >
                                            <div className={styles.itemImage}>
                                                <img 
                                                    src={offer.item.subCategory === 'head' || 
                                                        offer.item.subCategory === 'mouth' || 
                                                        offer.item.subCategory === 'eyes' || 
                                                        offer.item.subCategory === 'nose' 
                                                            ? offer.item.imageUrl.replace('.png', '_preview.png') 
                                                            : offer.item.imageUrl
                                                    } 
                                                    alt={offer.item.name}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.itemInfo}>
                                            <span className={styles.itemName}>{offer.item.name}</span>
                                            <span className={`${styles.itemRarity} ${styles[offer.item.rarity || '']}`}>
                                                {offer.item.rarity}
                                            </span>
                                            {offer.sellerAddress === walletAddress && offer.status === 'pending' && (
                                                <span className={styles.waitingText}>
                                                    Waiting for interested traders...
                                                </span>
                                            )}
                                            {offer.sellerAddress !== walletAddress && offer.status === 'pending' && (
                                                <button 
                                                    className={styles.tradeButton}
                                                    onClick={() => handleAcceptOffer(offer)}
                                                >
                                                    Trade Now
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {offers.length === 0 && (
                                <div className={styles.noOffers}>
                                    No active offers.
                                    <br />
                                    Make an offer to start trading!
                                </div>
                            )}
                        </div>
                        <div className={styles.tradeControls}>
                            <button className={styles.makeOfferButton} onClick={() => setIsSelectingItem(true)}>
                                Make Offer
                            </button>
                            <div className={styles.rarityFilters}>
                                <div className={styles.filterGroup}>
                                    <span className={styles.filterLabel}>Category:</span>
                                    {CATEGORY_FILTERS.map(filter => (
                                        <button
                                            key={filter.id}
                                            className={`${styles.filterButton} ${activeCategoryFilter === filter.id ? styles.active : ''}`}
                                            onClick={() => setActiveCategoryFilter(filter.id)}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.filterGroup}>
                                    <span className={styles.filterLabel}>Rarity:</span>
                                    <button
                                        className={`${styles.filterButton} ${!activeRarityFilter ? styles.active : ''}`}
                                        onClick={() => setActiveRarityFilter('')}
                                    >
                                        All
                                    </button>
                                    {RARITY_FILTERS.map(filter => (
                                        <button
                                            key={filter.id}
                                            className={`${styles.filterButton} ${activeRarityFilter === filter.id ? styles.active : ''}`}
                                            onClick={() => setActiveRarityFilter(filter.id)}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Online Traders Panel */}
                    <div className={styles.tradersPanel}>
                        <div className={styles.tradersPanelHeader}>
                            <h3>ONLINE TRADERS {onlineUsers.length}</h3>
                        </div>
                        <div className={styles.tradersList}>
                            {onlineUsers.map((user, index) => {
                                // Mock data for demonstration - replace with actual user data
                                const mockUserData = {
                                    name: user,
                                    status: 'online',
                                    role: index === 0 ? 'admin' : 
                                          index === 1 ? 'helper' : 
                                          index === 2 ? 'vip' : undefined,
                                    isChatting: index === 4
                                };

                                return (
                                    <div key={index} className={`${styles.traderItem} ${mockUserData.role ? styles[mockUserData.role] : ''}`}>
                                        <span className={`${styles.traderStatus} ${styles.online}`} />
                                        <span className={styles.traderName}>{mockUserData.name}</span>
                                        {mockUserData.isChatting && (
                                            <span className={styles.chatting} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Chat Section */}
                <div className={styles.chatSection}>
                    <div className={styles.messages}>
                        {messages.map(message => (
                            <div
                                key={message.id}
                                className={`${styles.message} ${message.isSystem ? styles.system : ''}`}
                            >
                                {!message.isSystem && (
                                    <span className={styles.sender}>{message.sender_name}:</span>
                                )}
                                <p>{message.message}</p>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className={styles.messageForm}>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className={styles.messageInput}
                            maxLength={MAX_MESSAGE_LENGTH}
                            disabled={!isConnected}
                        />
                        <button
                            type="submit"
                            className={styles.sendButton}
                            disabled={!isConnected || !newMessage.trim()}
                        >
                            Send
                        </button>
                    </form>
                </div>

                {/* Item Selection Overlay */}
                {isSelectingItem && (
                    <div className={styles.itemSelectionOverlay}>
                        <div className={styles.itemSelectionGrid}>
                            <div className={styles.gridHeader}>
                                <h4>Select an Item</h4>
                                <button 
                                    className={styles.closeButton}
                                    onClick={() => setIsSelectingItem(false)}
                                >
                                    X
                                </button>
                            </div>
                            <div className={styles.filterControls}>
                                <div className={styles.filterGroup}>
                                    <span className={styles.filterLabel}>Category:</span>
                                    {CATEGORY_FILTERS.map(filter => (
                                        <button
                                            key={filter.id}
                                            className={`${styles.filterButton} ${activeCategoryFilter === filter.id ? styles.active : ''}`}
                                            onClick={() => setActiveCategoryFilter(filter.id)}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                                <div className={styles.filterGroup}>
                                    <span className={styles.filterLabel}>Rarity:</span>
                                    <button
                                        className={`${styles.filterButton} ${!activeRarityFilter ? styles.active : ''}`}
                                        onClick={() => setActiveRarityFilter('')}
                                    >
                                        All
                                    </button>
                                    {RARITY_FILTERS.map(filter => (
                                        <button
                                            key={filter.id}
                                            className={`${styles.filterButton} ${activeRarityFilter === filter.id ? styles.active : ''}`}
                                            onClick={() => setActiveRarityFilter(filter.id)}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.itemsGrid}>
                                {availableItems
                                    .filter(item => 
                                        (!activeRarityFilter || item.rarity === activeRarityFilter) &&
                                        (activeCategoryFilter === 'all' || item.subCategory === activeCategoryFilter)
                                    )
                                    .map(item => (
                                        <div 
                                            key={item.id}
                                            className={styles.itemCard}
                                            data-rarity={item.rarity}
                                            onClick={() => handleSelectItem(item)}
                                        >
                                            <div className={styles.itemImage}>
                                                {item.imageUrl ? (
                                                    <img 
                                                        src={item.subCategory === 'head' || 
                                                            item.subCategory === 'mouth' || 
                                                            item.subCategory === 'eyes' || 
                                                            item.subCategory === 'nose' 
                                                                ? item.imageUrl.replace('.png', '_preview.png') 
                                                                : item.imageUrl
                                                        } 
                                                        alt={item.name} 
                                                    />
                                                ) : (
                                                    <div className={styles.placeholder}>{item.name.substring(0, 2)}</div>
                                                )}
                                            </div>
                                            <span className={styles.itemCount}>{item.quantity}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}; 