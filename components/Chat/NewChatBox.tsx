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

interface ServerTradeNegotiation {
    offerId: string;
    buyerAddress: string;
    sellerAddress: string;
    status: 'waiting' | 'locked' | 'cancelled' | 'completed';
    buyerItems: any[];
    sellerItems: any[];
}

interface ClientTradeNegotiation {
    offerId: string;
    partnerName: string;
    partnerAddress: string;
    status: 'waiting' | 'locked' | 'cancelled' | 'completed';
    yourItems: Item[];
    partnerItems: Item[];
}

interface TradeChatMessage {
    id: string;
    offerId: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: string;
}

interface ChatBoxProps {
    walletAddress: string;
    username: string;
    onBackToMenu: () => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
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

const TradeItemGrid: React.FC<{
    items: Item[];
    isLocked?: boolean;
    onSlotClick?: (index: number) => void;
    maxItems?: number;
}> = ({ items, isLocked, onSlotClick, maxItems = 6 }) => {
    return (
        <div className={styles.tradeItemsGrid}>
            {Array.from({ length: maxItems }).map((_, index) => {
                const item = items[index];
                return (
                    <div 
                        key={`slot-${index}`}
                        className={`${styles.tradeItemSlot} ${item ? styles.filled : ''}`}
                        onClick={() => !isLocked && onSlotClick?.(index)}
                    >
                        {item && item.imageUrl && (
                            <img 
                                src={item.imageUrl} 
                                alt={item.name || 'Trade item'}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

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
    const [activeTradeNegotiation, setActiveTradeNegotiation] = useState<ClientTradeNegotiation | null>(null);
    const [selectedTradeItems, setSelectedTradeItems] = useState<Item[]>([]);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [tradeChatMessages, setTradeChatMessages] = useState<TradeChatMessage[]>([]);
    const [tradeChatInput, setTradeChatInput] = useState('');
    const tradeChatEndRef = useRef<HTMLDivElement>(null);
    const [users, setUsers] = useState<{ walletAddress: string; username: string }[]>([]);
    const [isTradeOfferer, setIsTradeOfferer] = useState(false);

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

        // Remove existing listeners before adding new ones
        socketRef.current.removeAllListeners();

        socketRef.current.on('connect', () => {
            console.log('Connected to chat server');
            setIsConnected(true);
        });

        socketRef.current.on('disconnect', () => {
            console.log('Disconnected from chat server');
            setIsConnected(false);
        });

        // Add handler for initial active offers
        socketRef.current.on('activeOffers', (activeOffers: TradeOffer[]) => {
            console.log('🔵 Received initial active offers:', activeOffers);
            setOffers(activeOffers);
        });

        // Handle new trade offers
        socketRef.current.on('newTradeOffer', (offer: TradeOffer) => {
            console.log('🟢 Received new trade offer:', offer);
            setOffers(prev => {
                // Check if offer already exists to prevent duplicates
                if (prev.some(o => o.id === offer.id)) {
                    return prev;
                }
                return [offer, ...prev];
            });
        });

        // Handle cancelled offers
        socketRef.current.on('tradeOfferCancelled', (offerId: string) => {
            console.log('🔴 Trade offer cancelled:', offerId);
            setOffers(prev => prev.filter(offer => offer.id !== offerId));
        });

        socketRef.current.on('message', (message: ChatMessage) => {
            if (message.sender_address.toLowerCase() !== walletAddress.toLowerCase()) {
                setMessages(prev => [...prev, message]);
                scrollToBottom();
            }
        });

        socketRef.current.on('onlineUsers', (users: string[]) => {
            setOnlineUsers(users);
            setUsers(users.map(u => ({ walletAddress: u, username: '' })));
        });

        socketRef.current.on('error', (error: string) => {
            console.error('Socket error:', error);
        });

        // Add handler for trade negotiation started
        socketRef.current.on('tradeNegotiationStarted', (negotiation: ServerTradeNegotiation & { partnerName: string; partnerAddress: string }) => {
            console.log('🤝 Trade negotiation started:', negotiation);
            
            // Check if current user is the seller
            const isOfferer = negotiation.sellerAddress.toLowerCase() === walletAddress.toLowerCase();
            setIsTradeOfferer(isOfferer);
            
            // Create a clean copy of the items to prevent reference sharing
            const partnerItems = negotiation.sellerItems.map(item => ({
                ...item,
                id: `partner-${item.id}` // Add prefix to distinguish partner items
            }));
            
            setActiveTradeNegotiation({
                offerId: negotiation.offerId,
                partnerName: negotiation.partnerName,
                partnerAddress: negotiation.partnerAddress,
                status: negotiation.status,
                yourItems: [],
                partnerItems: partnerItems
            });

            // Add system message about trade start
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: `Trade negotiation started with ${negotiation.partnerName}`,
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);
        });

        // Add handler for trade lock updates
        socketRef.current.on('tradeLockUpdate', (data: { offerId: string; status: 'locked' | 'waiting'; items?: any[]; fromAddress?: string; partnerItems?: any[] }) => {
            console.log('🔒 Trade lock update:', data);
            
            setActiveTradeNegotiation(prev => {
                if (!prev || prev.offerId !== data.offerId) return prev;
                
                const isFromPartner = data.fromAddress?.toLowerCase() !== walletAddress.toLowerCase();
                console.log('Update from partner:', isFromPartner, 'Status:', data.status);
                
                // Clean and prepare items
                const cleanItems = (items: any[] = []) => items.map(item => ({
                    ...item,
                    id: item.id.replace(/^(locked-|your-|partner-)*/g, '')
                }));

                let yourItems = prev.yourItems;
                let partnerItems = prev.partnerItems;

                if (isFromPartner) {
                    // Partner's update
                    partnerItems = data.items ? cleanItems(data.items) : prev.partnerItems;
                    if (data.partnerItems) {
                        yourItems = cleanItems(data.partnerItems);
                        // Update selectedTradeItems when receiving partner's update
                        setSelectedTradeItems(yourItems);
                    }
                } else {
                    // Your update
                    yourItems = data.items ? cleanItems(data.items) : prev.yourItems;
                    partnerItems = data.partnerItems ? cleanItems(data.partnerItems) : prev.partnerItems;
                }

                console.log('Updating trade state:', {
                    status: data.status,
                    yourItems,
                    partnerItems
                });

                return {
                    ...prev,
                    status: data.status,
                    yourItems,
                    partnerItems
                };
            });

            // Add system message about lock status
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: `Trade ${data.status === 'locked' ? 'locked' : 'unlocked'} by ${
                    data.fromAddress ? 
                        (data.fromAddress.toLowerCase() === walletAddress.toLowerCase() ? 'you' : 'partner') : 
                        'partner'
                }`,
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);
        });

        // Add handler for trade negotiation cancelled
        socketRef.current.on('tradeNegotiationCancelled', (data: { offerId: string; reason: string }) => {
            console.log('❌ Trade negotiation cancelled:', data);
            if (activeTradeNegotiation?.offerId === data.offerId) {
                setActiveTradeNegotiation(null);
                setSelectedTradeItems([]);
                
                // Show cancellation message
                const systemMessage = {
                    id: generateTempId(),
                    sender_address: 'system',
                    sender_name: 'System',
                    message: `Trade cancelled: ${data.reason}`,
                    created_at: new Date().toISOString(),
                    isSystem: true
                };
                setMessages(prev => [...prev, systemMessage]);
            }
        });

        // Add handler for trade chat messages
        socketRef.current.on('tradeChatMessage', (message: TradeChatMessage) => {
            console.log('Trade chat message received:', message);
            setTradeChatMessages(prev => [...prev, message]);
        });
    }, [walletAddress, username, scrollToBottom, activeTradeNegotiation, users]);

    useEffect(() => {
        // Only create socket connection if it doesn't exist
        if (!socketRef.current) {
        socketRef.current = io(SOCKET_URL, {
            reconnection: true,
            reconnectionAttempts: RECONNECT_ATTEMPTS,
            reconnectionDelay: RECONNECT_DELAY,
            transports: ['websocket', 'polling'],
            timeout: 10000,
                forceNew: false // Changed to false to prevent multiple connections
        });

        setupSocketListeners();
        }

        // Cleanup function
        return () => {
            if (socketRef.current) {
                socketRef.current.removeAllListeners();
                socketRef.current.disconnect();
                socketRef.current = undefined;
            }
        };
    }, []); // Empty dependency array since we only want to set up once

    // Move the socket event setup to a separate useEffect
    useEffect(() => {
        if (socketRef.current?.connected && isConnected) {
            // Emit join event when socket is connected and ready
            socketRef.current.emit('join', { walletAddress, username });
            console.log('Emitted join event with:', { walletAddress, username });
        }
    }, [isConnected, walletAddress, username]);

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

            // Emit the message to the server first
            socketRef.current?.emit('message', {
                walletAddress: walletAddress.toLowerCase(),
                username,
                message: trimmedMessage,
                timestamp: new Date().toISOString(),
            });

            // Clear the input field
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleSelectItem = (item: Item) => {
        if (activeTradeNegotiation) {
            // If we're in a trade negotiation
            if (selectedSlotIndex !== null) {
                const uniqueItem = {
                    ...item,
                    id: `your-${item.id}-${Date.now()}` // Add prefix and timestamp to make unique
                };
                setSelectedTradeItems(prev => {
                    const newItems = [...prev];
                    newItems[selectedSlotIndex] = uniqueItem;
                    return newItems;
                });
                setSelectedSlotIndex(null);
            }
        } else {
            // Normal offer creation
        handleMakeOffer(item);
        }
        setIsSelectingItem(false);
    };

    const handleMakeOffer = (selectedItem: Item) => {
        console.log('Making new offer for item:', selectedItem);
        
        // Create new offer with unique ID
        const newOffer: TradeOffer = {
            id: `offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sellerName: username,
            sellerAddress: walletAddress,
            item: selectedItem,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        console.log('🟡 Emitting makeTradeOffer with:', newOffer);
        // Emit the offer to the server
        if (socketRef.current?.connected) {
            socketRef.current.emit('makeTradeOffer', {
                ...newOffer,
                offerer: walletAddress,
                offererSocketId: socketRef.current.id,
                offererItems: [selectedItem],
                partnerItems: [],
                partner: '',
                partnerSocketId: ''
            });
        } else {
            console.error('Socket not connected, cannot make offer');
            // Show error message to user
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: 'Error: Could not create offer. Please try again.',
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);
        }
    };

    const handleCancelOffer = (offerId: string) => {
        console.log('🔴 Requesting to cancel offer:', offerId);
        socketRef.current?.emit('cancelTradeOffer', offerId);
        // No need to update local state here as it will be handled by the socket event
    };

    const handleCloseOffer = () => {
        setIsOfferActive(false);
        setSelectedItems([]);
    };

    const handleAcceptOffer = (offer: TradeOffer) => {
        console.log('🤝 Accepting trade offer:', offer);
        if (!socketRef.current?.connected) {
            console.error('Socket not connected, cannot accept trade');
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: 'Error: Could not start trade. Please try again.',
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);
            return;
        }

        // Clear any previously selected items
        setSelectedTradeItems([]);

        // Emit the trade acceptance to the server
        socketRef.current.emit('acceptTradeOffer', {
            offerId: offer.id,
            acceptedBy: username,
            acceptedByAddress: walletAddress.toLowerCase()
        });

        console.log('🤝 Emitted acceptTradeOffer event');
    };

    const handleTradeItemSelect = (item: Item) => {
        if (selectedTradeItems.length >= 6 && !selectedTradeItems.find(i => i.id === item.id)) {
            return; // Already have max items
        }

        setSelectedTradeItems(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.filter(i => i.id !== item.id);
            }
            if (prev.length >= 6) {
                return prev;
            }
            return [...prev, item];
        });
    };

    const handleLockTrade = () => {
        if (!activeTradeNegotiation) return;

        // Filter out any invalid items and create locked items
        const validItems = selectedTradeItems.filter(item => item && item.id);
        
        if (validItems.length === 0) {
            console.error('No valid items to lock');
            return;
        }

        const lockedItems = validItems.map(item => ({
            ...item,
            id: item.id.startsWith('locked-') ? item.id : `locked-${item.id}`
        }));

        // Update the trade negotiation state
        setActiveTradeNegotiation(prev => prev ? {
            ...prev,
            status: 'locked',
            yourItems: lockedItems
        } : null);

        // Update the selected items state
        setSelectedTradeItems(lockedItems);

        // Emit socket event for trade lock
        socketRef.current?.emit('tradeLock', {
            offerId: activeTradeNegotiation.offerId,
            items: lockedItems,
            walletAddress: walletAddress.toLowerCase() // Ensure wallet address is included and normalized
        });
    };

    const handleUnlockTrade = () => {
        if (!activeTradeNegotiation) return;
        
        // Reset the selected items to their original state (without the 'locked-' prefix)
        const originalItems = selectedTradeItems
            .filter(item => item && item.id)
            .map(item => ({
                ...item,
                id: item.id.replace('locked-', '').replace('your-', '') // Remove both prefixes
            }));

        // Update the trade negotiation state
        setActiveTradeNegotiation(prev => {
            if (!prev) return null;
            return { 
                ...prev, 
                status: 'waiting',
                yourItems: originalItems
            };
        });

        // Update the selected items state with the original items
        setSelectedTradeItems(originalItems);

        // Emit socket event for trade unlock with items
        socketRef.current?.emit('tradeUnlock', {
            offerId: activeTradeNegotiation.offerId,
            walletAddress: walletAddress.toLowerCase(),
            items: originalItems // Send the updated items
        });
    };

    const handleRejectTrade = () => {
        if (!activeTradeNegotiation) return;
        
        // Here you would emit the trade rejection event to the server
        console.log('Rejecting trade');
        setActiveTradeNegotiation(null);
        setSelectedTradeItems([]);
    };

    // Add a useEffect to monitor offers state changes
    useEffect(() => {
        console.log('🔄 Offers state updated:', offers);
    }, [offers]);

    // Update the trade item slot click handler
    const handleTradeSlotClick = (index: number) => {
        if (activeTradeNegotiation?.status === 'locked') return;
        setSelectedSlotIndex(index);
        setIsSelectingItem(true);
    };

    // Add auto-scroll effect for trade chat
    useEffect(() => {
        tradeChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [tradeChatMessages]);

    const handleSendTradeMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tradeChatInput.trim() || !activeTradeNegotiation) return;

        const newMessage: TradeChatMessage = {
            id: `trade-msg-${Date.now()}`,
            offerId: activeTradeNegotiation.offerId,
            sender: username,
            senderAddress: walletAddress,
            content: tradeChatInput.trim(),
            timestamp: new Date().toISOString()
        };

        // Clear input first
        setTradeChatInput('');

        // Emit socket event
        socketRef.current?.emit('tradeChatMessage', {
            offerId: activeTradeNegotiation.offerId,
            message: newMessage
        });
    };

    // Update the trade items display logic
    const displayItems = React.useMemo(() => {
        if (!activeTradeNegotiation) return [];
        
        // If we're the offerer, always show our items
        if (isTradeOfferer) {
            return activeTradeNegotiation.yourItems || [];
        }
        
        // For the partner, show selected items or locked items
        return activeTradeNegotiation.status === 'locked' 
            ? activeTradeNegotiation.yourItems || []
            : selectedTradeItems;
    }, [activeTradeNegotiation, selectedTradeItems, isTradeOfferer]);

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
                        <div className={styles.offerGrid}>
                            {offers.map(offer => (
                                <div 
                                    key={offer.id} 
                                    className={`${styles.offerCard} ${offer.sellerAddress === walletAddress ? styles.waiting : ''}`}
                                >
                                    <div className={styles.offerHeader}>
                                        <span className={styles.offerSellerName}>{offer.sellerName}</span>
                                    </div>
                                    <div className={styles.offerItemDisplay}>
                                        <div 
                                            className={styles.offerItemCard}
                                            data-rarity={offer.item.rarity}
                                        >
                                            <div className={styles.offerItemImage}>
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
                                        <div className={styles.offerItemInfo}>
                                            <span className={styles.offerItemName}>{offer.item.name}</span>
                                            <span className={styles.offerItemRarity}>
                                                {offer.item.rarity}
                                            </span>
                                            {offer.sellerAddress === walletAddress && (
                                                <span className={styles.offerWaitingText}>
                                                    Waiting for interested traders...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.offerActions}>
                                        {offer.sellerAddress === walletAddress ? (
                                            <button 
                                                className={styles.offerCancelButton}
                                                onClick={() => handleCancelOffer(offer.id)}
                                            >
                                                Cancel
                                            </button>
                                        ) : (
                                            <button 
                                                className={styles.tradeButton}
                                                onClick={() => handleAcceptOffer(offer)}
                                                disabled={offer.sellerAddress.toLowerCase() === walletAddress.toLowerCase()}
                                            >
                                                Trade
                                            </button>
                                        )}
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
                                <h4>Select an Item {selectedSlotIndex !== null ? `for slot ${selectedSlotIndex + 1}` : ''}</h4>
                                <button 
                                    className={styles.closeButton}
                                    onClick={() => {
                                        setIsSelectingItem(false);
                                        setSelectedSlotIndex(null);
                                    }}
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

                {/* Trade Negotiation Overlay */}
                {activeTradeNegotiation && (
                    <div className={styles.tradeNegotiationOverlay}>
                        <div className={styles.tradeNegotiationContainer}>
                            <div className={styles.tradeHeader}>
                                <div className={styles.tradePartnerInfo}>
                                    {isTradeOfferer ? (
                                        <span className={styles.tradePartnerName}>
                                            Trader interested: {activeTradeNegotiation.partnerName}
                                        </span>
                                    ) : (
                                        <span className={styles.tradePartnerName}>
                                            Your Partner: {activeTradeNegotiation.partnerName}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className={styles.tradeGrid}>
                                {!isTradeOfferer ? (
                                    <>
                                        <div className={`${styles.tradeSide} ${activeTradeNegotiation?.status === 'locked' ? styles.locked : ''}`}>
                                            <div className={styles.tradeSideHeader}>
                                                <span className={styles.tradeSideTitle}>You give:</span>
                                            </div>
                                            <TradeItemGrid 
                                                items={activeTradeNegotiation?.status === 'locked' ? 
                                                    activeTradeNegotiation.yourItems || [] : 
                                                    selectedTradeItems}
                                                isLocked={activeTradeNegotiation?.status === 'locked'}
                                                onSlotClick={handleTradeSlotClick}
                                                maxItems={6}
                                            />
                                            <div className={styles.tradeCoins}>
                                                and <span>0 Coins</span>
                                            </div>
                                        </div>
                                        <div className={styles.tradeSide}>
                                            <div className={styles.tradeSideHeader}>
                                                <span className={styles.tradeSideTitle}>Item:</span>
                                            </div>
                                            <TradeItemGrid 
                                                items={activeTradeNegotiation?.partnerItems || []}
                                                maxItems={6}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.tradeSide}>
                                        <div className={styles.tradeSideHeader}>
                                            <span className={styles.tradeSideTitle}>you get:</span>
                                        </div>
                                        <TradeItemGrid 
                                            items={activeTradeNegotiation?.partnerItems || []}
                                            maxItems={6}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className={styles.tradeActions}>
                                {isTradeOfferer ? (
                                    <button 
                                        className={styles.tradeRejectButton}
                                        onClick={handleRejectTrade}
                                    >
                                        Reject
                                    </button>
                                ) : (
                                    <>
                                        {activeTradeNegotiation.status === 'locked' ? (
                                            <button 
                                                className={styles.tradeUnlockButton}
                                                onClick={handleUnlockTrade}
                                            >
                                                Unlock Trade
                                            </button>
                                        ) : (
                                            <button 
                                                className={styles.tradeLockButton}
                                                onClick={handleLockTrade}
                                                disabled={selectedTradeItems.length === 0}
                                            >
                                                OK, COOL!
                                            </button>
                                        )}
                                        <button 
                                            className={styles.tradeRejectButton}
                                            onClick={handleRejectTrade}
                                        >
                                            Leave
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className={`${styles.tradeStatus} ${styles[activeTradeNegotiation.status + 'Status']}`}>
                                {isTradeOfferer && activeTradeNegotiation.status === 'waiting' && 'Waiting for partner to lock...'}
                                {!isTradeOfferer && activeTradeNegotiation.status === 'waiting' && 'Select items to trade...'}
                                {activeTradeNegotiation.status === 'locked' && 'Trade locked! Waiting for partner...'}
                                {activeTradeNegotiation.status === 'cancelled' && 'Trade cancelled'}
                            </div>

                            <div className={styles.tradeChatSection}>
                                <div className={styles.tradeChatHeader}>
                                    <span>Trade Chat with {activeTradeNegotiation.partnerName}</span>
                                </div>
                                <div className={styles.tradeChatMessages}>
                                    {tradeChatMessages.map(msg => (
                                        <div 
                                            key={msg.id}
                                            className={`${styles.tradeChatMessage} ${msg.senderAddress.toLowerCase() === walletAddress.toLowerCase() ? styles.self : ''}`}
                                        >
                                            <span className={styles.sender}>{msg.sender}:</span>
                                            <div className={styles.content}>{msg.content}</div>
                                        </div>
                                    ))}
                                    <div ref={tradeChatEndRef} />
                                </div>
                                <form onSubmit={handleSendTradeMessage} className={styles.tradeChatInput}>
                                    <input
                                        type="text"
                                        value={tradeChatInput}
                                        onChange={(e) => setTradeChatInput(e.target.value)}
                                        placeholder="Type a message..."
                                        maxLength={100}
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!tradeChatInput.trim()}
                                    >
                                        Send
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}; 