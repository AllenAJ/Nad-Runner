import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './NewChatBox.module.css';
import { TradeSection } from './TradeSection';

interface Item {
    id: string;
    name: string;
    imageUrl: string;
    rarity?: 'normal' | 'prem' | 'rare' | 'event' | 'ultra' | 'cash' | 'legendary' | 'epic';
}

interface TradeOffer {
    id: string;
    sellerName: string;
    sellerAddress: string;
    item: Item;
    timestamp: string;
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
    { id: 'normal', label: 'normal' },
    { id: 'prem', label: 'prem' },
    { id: 'rare', label: 'rare' },
    { id: 'event', label: 'event' },
    { id: 'ultra', label: 'ultra' },
    { id: 'cash', label: 'cash' }
];

export const NewChatBox: React.FC<ChatBoxProps> = ({ walletAddress, username, onBackToMenu }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket>();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [activeFilter, setActiveFilter] = useState('normal');
    const [isSelectingItem, setIsSelectingItem] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [offers, setOffers] = useState<TradeOffer[]>([]);

    // Mock items - replace with actual inventory items
    const mockItems: Item[] = [
        { id: '1', name: 'Halo', imageUrl: '/assets/items/halo.png', rarity: 'legendary' },
        { id: '2', name: 'Cool Glass', imageUrl: '/assets/items/coolglass.png', rarity: 'epic' },
        { id: '3', name: 'Bow', imageUrl: '/assets/items/bow.png', rarity: 'rare' },
    ];

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
                                    {mockItems
                                        .filter(item => !activeFilter || item.rarity === activeFilter)
                                        .map(item => (
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
                            <div className={styles.itemsGrid}>
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
                        <div className={styles.tradeControls}>
                            <button className={styles.makeOfferButton} onClick={handleMakeOffer}>
                                Make Offer
                            </button>
                            <div className={styles.rarityFilters}>
                                {RARITY_FILTERS.map(filter => (
                                    <button
                                        key={filter.id}
                                        className={`${styles.filterButton} ${activeFilter === filter.id ? styles.active : ''}`}
                                        onClick={() => setActiveFilter(filter.id)}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
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
            </div>
        </div>
    );
}; 