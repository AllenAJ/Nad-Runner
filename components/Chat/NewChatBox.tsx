import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './NewChatBox.module.css';
import { TradeSection } from './TradeSection';
import { useInventory } from '../../contexts/InventoryContext';
import { Item as InventoryItem, Rarity, SubCategory } from '../../types/inventory';
import { RARITY_COLORS, INITIAL_ITEMS } from '../../constants/inventory';
import { Alert } from '../Game/Alert';

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
    status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'cancelled';
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
    originalOfferItems: Item[];
    isLocked?: boolean;
    isPartnerLocked?: boolean;
}

interface TradeChatMessage {
    id: string;
    offerId: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: string;
}

// Define structure for online user data
interface OnlineUser {
    username: string;
    walletAddress: string;
    equippedSkinId: string | null; // Revert back to ID
    // equippedSkinImageUrl: string | null; // Remove image URL
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

const PartnerTradeItemGrid: React.FC<{
    items: Item[];
    isLocked?: boolean;
    onSlotClick?: (index: number) => void;
    maxItems?: number;
}> = ({ items, isLocked, onSlotClick, maxItems = 6 }) => {
    return (
        <div className={styles.partnerTradeItemsGrid}>
            {Array.from({ length: maxItems }).map((_, index) => {
                const item = items[index];
                return (
                    <div 
                        key={`partner-slot-${index}`}
                        className={`${styles.partnerTradeItemSlot} ${item ? styles.filled : ''}`}
                        onClick={() => !isLocked && onSlotClick?.(index)}
                    >
                        {item && item.imageUrl && (
                            <img 
                                src={item.subCategory === 'head' || 
                                    item.subCategory === 'mouth' || 
                                    item.subCategory === 'eyes' || 
                                    item.subCategory === 'nose' 
                                        ? item.imageUrl.replace('.png', '_preview.png') 
                                        : item.imageUrl
                                } 
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

const OffererTradeItemGrid: React.FC<{
    items: Item[];
    maxItems?: number;
}> = ({ items, maxItems = 6 }) => {
    return (
        <div className={styles.offererTradeItemsGrid}>
            {Array.from({ length: maxItems }).map((_, index) => {
                const item = items[index];
                return (
                    <div 
                        key={`offerer-slot-${index}`}
                        className={`${styles.offererTradeItemSlot} ${item ? styles.filled : ''}`}
                    >
                        {item && item.imageUrl && (
                            <img 
                                src={item.subCategory === 'head' || 
                                    item.subCategory === 'mouth' || 
                                    item.subCategory === 'eyes' || 
                                    item.subCategory === 'nose' 
                                        ? item.imageUrl.replace('.png', '_preview.png') 
                                        : item.imageUrl
                                } 
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
    const { items: inventoryItems, updateInventory } = useInventory();
    const [isOfferActive, setIsOfferActive] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Item[]>([]);
    const [activeTradeNegotiation, setActiveTradeNegotiation] = useState<ClientTradeNegotiation | null>(null);
    const [selectedTradeItems, setSelectedTradeItems] = useState<Item[]>([]);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [tradeChatMessages, setTradeChatMessages] = useState<TradeChatMessage[]>([]);
    const [tradeChatInput, setTradeChatInput] = useState('');
    const tradeChatEndRef = useRef<HTMLDivElement>(null);
    const [users, setUsers] = useState<OnlineUser[]>([]);
    const [isTradeOfferer, setIsTradeOfferer] = useState(false);
    const [alertState, setAlertState] = useState<{ show: boolean; message: string; type?: 'info' | 'warning' | 'error' }>({ show: false, message: '' });

    // Convert inventory items to the format we need, handling undefined case
    const availableItems: Item[] = React.useMemo(() => {
        // First get all items from INITIAL_ITEMS that are in the inventory
        const inventoryItemIds = Object.keys(inventoryItems);
        
        return INITIAL_ITEMS
            .filter(item => {
                // Only include items that are in the inventory
                const count = inventoryItems[item.id] || 0;
                return count > 0;
            })
            .map(item => ({
                id: item.id,
                name: item.name,
                imageUrl: item.imageUrl || `/assets/items/${item.id}.png`,
                rarity: item.rarity,
                quantity: inventoryItems[item.id] || 0,
                subCategory: item.subCategory
            }));
    }, [inventoryItems]);

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

        socketRef.current.on('disconnect', (reason: string) => {
            console.log('Disconnected from chat server:', reason);
            setIsConnected(false);
            setUsers([]);
            setOffers([]);
            setActiveTradeNegotiation(null);
            
            setAlertState({ 
                show: true, 
                message: `Disconnected from server: ${reason}. Returning to menu.`,
                type: 'error' 
            });
        });

        socketRef.current.on('connect_error', (error: Error) => {
            console.error('Connection error:', error);
            setIsConnected(false);
            setAlertState({ 
                show: true, 
                message: `Connection error: ${error.message}. Returning to menu.`,
                type: 'error' 
            });
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

        // Update onlineUsers listener
        socketRef.current.on('onlineUsers', (receivedUsers: OnlineUser[]) => {
            console.log('Received online users:', receivedUsers);
            setUsers(receivedUsers);
        });

        socketRef.current.on('error', (error: string) => {
            // Keep this generic error handler for now, but prioritize serverAlert
            console.error('Generic socket error:', error);
            // Optionally show a generic alert if specific serverAlert isn't used
            // handleTradeError(`Socket error: ${error}`); 
        });

        // *** ADDED: Listener for specific server alerts ***
        socketRef.current.on('serverAlert', (data: { message: string; type?: 'info' | 'warning' | 'error' }) => {
            console.log(`🚨 Server Alert (${data.type || 'info'}):`, data.message);
            setAlertState({ 
                show: true, 
                message: data.message,
                type: data.type || 'info' 
            });
        });
        // *** END ADDED ***

        // Update the tradeNegotiationStarted handler
        socketRef.current.on('tradeNegotiationStarted', (data: {
            offerId: string;
            partnerName: string;
            partnerAddress: string;
            status: 'waiting' | 'locked' | 'cancelled' | 'completed';
            yourItems: Item[];
            partnerItems: Item[];
            originalOfferItems: Item[];
            isOfferer: boolean;
        }) => {
            console.log('🤝 Trade negotiation started:', data);
            
            // Set the trade negotiation state
            setActiveTradeNegotiation({
                offerId: data.offerId,
                partnerName: data.partnerName,
                partnerAddress: data.partnerAddress,
                status: data.status,
                yourItems: data.yourItems || [],
                partnerItems: data.partnerItems || [],
                originalOfferItems: data.originalOfferItems || [],
                isLocked: data.isOfferer,
                isPartnerLocked: !data.isOfferer
            });

            // Set initial selected items if you're the offerer
            if (data.isOfferer) {
                setSelectedTradeItems(data.yourItems || []);
                setIsTradeOfferer(true);
            } else {
                setSelectedTradeItems([]);
                setIsTradeOfferer(false);
            }

            // Clear any existing trade chat messages
            setTradeChatMessages([]);

            // Add system message
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: `Trade negotiation started with ${data.partnerName}`,
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);
        });

        // Add handler for trade lock updates
        socketRef.current.on('tradeLockUpdate', (data: { 
            offerId: string; 
            status: 'waiting' | 'locked'; 
            yourItems: any[]; 
            partnerItems: any[]; 
            fromAddress: string;
            locked: boolean;
            partnerLocked: boolean;
        }) => {
            console.log('🔒 CLIENT: Received tradeLockUpdate event:', JSON.stringify(data, null, 2));

            setActiveTradeNegotiation(prev => {
                if (!prev || prev.offerId !== data.offerId) {
                    console.log('🔒 CLIENT: No active negotiation found for this update');
                    return prev;
                }

                const newState = {
                    ...prev,
                    status: data.status,
                    yourItems: data.yourItems || [],
                    partnerItems: data.partnerItems || [],
                    isLocked: data.locked,
                    isPartnerLocked: data.partnerLocked
                };

                console.log('🔒 CLIENT: Updating negotiation state:', {
                    from: JSON.stringify(prev, null, 2),
                    to: JSON.stringify(newState, null, 2),
                    isSeller: prev.originalOfferItems && prev.originalOfferItems.length > 0,
                    locked: data.locked,
                    partnerLocked: data.partnerLocked
                });

                return newState;
            });

            // Add system message about lock status
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: `Trade state update: ${data.locked ? 'You are locked' : 'You are unlocked'}, ${data.partnerLocked ? 'Partner is locked' : 'Partner is unlocked'}`,
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);
        });

        // Add handler for trade negotiation cancelled
        socketRef.current.on('tradeNegotiationCancelled', (data: { offerId: string; reason: string }) => {
            console.log('❌ Trade negotiation cancelled:', data);
            // Remove the conditional check to ensure UI always closes
            setActiveTradeNegotiation(null);
            setSelectedTradeItems([]);
            setIsTradeOfferer(false); // Reset the offerer status
            setTradeChatMessages([]); // Clear trade chat
            
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
        });

        // Add handler for trade chat messages
        socketRef.current.on('tradeChatMessage', (message: TradeChatMessage) => {
            console.log('Trade chat message received:', message);
            setTradeChatMessages(prev => [...prev, message]);
        });

        // Add handler for trade accepted
        socketRef.current.on('tradeAccepted', (data: { offerId: string; acceptedBy: string }) => {
            console.log('🤝 Trade accepted:', data);
            
            // Add system message
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: `Trade accepted by ${data.acceptedBy}!`,
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);

            // Clear the trade negotiation
            setActiveTradeNegotiation(null);
            setSelectedTradeItems([]);
        });

        // Add handlers for trade completion and failure
        socketRef.current.on('tradeCompleted', (data: {
            offerId: string;
            receivedItems: Item[];
            givenItems: Item[];
            newInventory: Record<string, number>;
        }) => {
            console.log('🎉 Trade completed:', data);
            
            // Update inventory context
            if (updateInventory) {
                updateInventory(data.newInventory);
            }

            // Clear trade state
            setActiveTradeNegotiation(null);
            setSelectedTradeItems([]);
            setTradeChatMessages([]);

            // Format item names for message
            const receivedItemNames = data.receivedItems
                .map(item => item.name)
                .join(', ');
            const givenItemNames = data.givenItems
                .map(item => item.name)
                .join(', ');

            // Add success message
            const systemMessage = {
                id: generateTempId(),
                sender_address: 'system',
                sender_name: 'System',
                message: `Trade completed successfully!\n\nReceived: ${receivedItemNames}\nGave: ${givenItemNames}`,
                created_at: new Date().toISOString(),
                isSystem: true
            };
            setMessages(prev => [...prev, systemMessage]);

            // Play success sound if available
            if (chatSound) {
                chatSound.currentTime = 0;
                chatSound.play().catch(console.error);
            }
        });

        socketRef.current.on('tradeFailed', (data: { offerId: string; error: string }) => {
            handleTradeError(data.error);
            
            // Reset trade state if needed
            if (activeTradeNegotiation?.offerId === data.offerId) {
                setActiveTradeNegotiation(prev => prev ? {
                    ...prev,
                    status: 'waiting'
                } : null);
            }
        });

        // Add the new socket event handler in setupSocketListeners
        socketRef.current.on('offerStatusUpdate', (data: { offerId: string; status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'cancelled' }) => {
            console.log('📊 Offer status update:', data);
            setOffers(prev => prev.map(offer => 
                offer.id === data.offerId 
                    ? { ...offer, status: data.status }
                    : offer
            ));
        });

        socketRef.current.on('offerRemoved', (offerId: string) => {
            console.log('🗑️ Offer removed:', offerId);
            setOffers(prev => prev.filter(offer => offer.id !== offerId));
        });
    }, [walletAddress, username, scrollToBottom, activeTradeNegotiation, users, updateInventory, offers]);

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
        
        if (!trimmedMessage || !isConnected || !socketRef.current) return;

        const timestamp = new Date().toISOString();
        const tempId = generateTempId(); // Generate a temporary ID for optimistic update

        // 1. Optimistically add the message to the local state
        const sentMessage: ChatMessage = {
            id: tempId, // Use temp ID
            sender_address: walletAddress.toLowerCase(),
            sender_name: username,
            message: trimmedMessage,
            created_at: timestamp,
            isSystem: false
        };
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage(''); // Clear input field immediately
        scrollToBottom(); // Scroll down

        try {
            if (chatSound) {
                chatSound.currentTime = 0;
                await chatSound.play().catch(console.error); // Added catch for safety
            }

            // 2. Emit the message to the server
            socketRef.current.emit('message', {
                walletAddress: walletAddress.toLowerCase(),
                username,
                message: trimmedMessage,
                timestamp: timestamp, // Use the same timestamp
            });

            // Note: We keep the server listener filtering out our own messages
            // to avoid duplicates if the server echoes messages back to the sender.

        } catch (error) {
            console.error('Error sending message:', error);
            // Optional: Remove the optimistically added message on error
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
            handleTradeError('Failed to send message.'); // Show error to user
        }
    };

    const handleSelectItem = (item: Item) => {
        if (activeTradeNegotiation) {
            // If we're in a trade negotiation
            if (selectedSlotIndex !== null) {
                // --- Quantity Check Start ---
                const baseItemId = item.id.split('-')[0].replace(/^(locked-|your-|partner-|original-)*/g, '');
                const inventoryItem = availableItems.find(invItem => invItem.id.split('-')[0].replace(/^(locked-|your-|partner-|original-)*/g, '') === baseItemId);
                const ownedQuantity = inventoryItem ? inventoryItem.quantity : 0;

                const currentSelectionCount = selectedTradeItems.reduce((count, selectedItem) => {
                    if (selectedItem && selectedItem.id.split('-')[0].replace(/^(locked-|your-|partner-|original-)*/g, '') === baseItemId) {
                        return count + 1;
                    }
                    return count;
                }, 0);

                // Check if adding this item exceeds owned quantity
                if (currentSelectionCount >= ownedQuantity) {
                    handleTradeError(`You only have ${ownedQuantity} of ${item.name} and have already selected ${currentSelectionCount}.`);
                    setIsSelectingItem(false); // Close the selection overlay
                    setSelectedSlotIndex(null);
                    return; // Prevent adding the item
                }
                // --- Quantity Check End ---

                const uniqueItem = {
                    ...item,
                    // Use a simpler unique ID strategy if needed, or ensure base ID comparison works
                    // id: `your-${baseItemId}-${Date.now()}` // Example unique ID
                };
                setSelectedTradeItems(prev => {
                    const newItems = [...prev];
                    newItems[selectedSlotIndex] = uniqueItem; // Place item in the selected slot
                    return newItems;
                });
                setSelectedSlotIndex(null);
            }
        } else {
            // Normal offer creation (only allows one item)
            handleMakeOffer(item);
        }
        setIsSelectingItem(false);
    };

    const handleMakeOffer = (selectedItem: Item) => {
        if (!socketRef.current?.connected) {
            handleTradeError('Not connected to server');
            return;
        }

        const newOffer: TradeOffer = {
            id: `offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sellerName: username,
            sellerAddress: walletAddress,
            item: selectedItem,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        socketRef.current.emit('makeTradeOffer', {
            ...newOffer,
            offerer: walletAddress,
            offererSocketId: socketRef.current.id,
            offererItems: [selectedItem],
            partnerItems: [],
            partner: '',
            partnerSocketId: ''
        });

        // Add loading message
        setMessages(prev => [...prev, {
            id: generateTempId(),
            sender_address: 'system',
            sender_name: 'System',
            message: 'Creating trade offer...',
            created_at: new Date().toISOString(),
            isSystem: true
        }]);
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
        if (!socketRef.current?.connected) {
            handleTradeError('Not connected to server');
            return;
        }

        socketRef.current.emit('acceptTradeOffer', {
            offerId: offer.id,
            acceptedBy: username,
            acceptedByAddress: walletAddress.toLowerCase()
        });

        // Add loading message
        setMessages(prev => [...prev, {
            id: generateTempId(),
            sender_address: 'system',
            sender_name: 'System',
            message: 'Accepting trade offer...',
            created_at: new Date().toISOString(),
            isSystem: true
        }]);
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
        if (!activeTradeNegotiation || !socketRef.current?.connected) {
            handleTradeError('Cannot lock trade: negotiation not active or not connected');
            return;
        }

        const validItems = selectedTradeItems.filter(item => item && item.id);
        if (validItems.length === 0) {
            handleTradeError('No items selected for trade');
            return;
        }

        const lockedItems = validItems.map(item => ({
            ...item,
            id: item.id.startsWith('locked-') ? item.id : `locked-${item.id}`
        }));

        socketRef.current.emit('tradeLock', {
            offerId: activeTradeNegotiation.offerId,
            items: lockedItems,
            walletAddress: walletAddress.toLowerCase()
        });

        // Add loading message
        setMessages(prev => [...prev, {
            id: generateTempId(),
            sender_address: 'system',
            sender_name: 'System',
            message: 'Locking trade items...',
            created_at: new Date().toISOString(),
            isSystem: true
        }]);
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
        
        // Emit rejection event to server
        socketRef.current?.emit('rejectTrade', {
            offerId: activeTradeNegotiation.offerId,
            rejectedBy: username,
            rejectedByAddress: walletAddress.toLowerCase()
        });

        // Clear local state
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

    const handleAcceptTrade = () => {
        if (!activeTradeNegotiation || !socketRef.current?.connected) {
            handleTradeError('Cannot accept trade: negotiation not active or not connected');
            return;
        }

        socketRef.current.emit('acceptTrade', {
            offerId: activeTradeNegotiation.offerId,
            acceptedBy: username,
            acceptedByAddress: walletAddress.toLowerCase()
        });

        // Add loading message
        setMessages(prev => [...prev, {
            id: generateTempId(),
            sender_address: 'system',
            sender_name: 'System',
            message: 'Processing trade acceptance...',
            created_at: new Date().toISOString(),
            isSystem: true
        }]);
    };

    // Add error handling for trade operations
    const handleTradeError = (error: string) => {
        setMessages(prev => [...prev, {
            id: generateTempId(),
            sender_address: 'system',
            sender_name: 'System',
            message: `Error: ${error}`,
            created_at: new Date().toISOString(),
            isSystem: true
        }]);
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.chatContainer}>
                {/* Alert Component */}
                {alertState.show && (
                    <Alert 
                        message={alertState.message}
                        type={alertState.type}
                        onClose={() => {
                            setAlertState({ show: false, message: '' });
                            onBackToMenu();
                        }}
                    />
                )}

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
                                    className={`${styles.offerCard} ${
                                        offer.status === 'negotiating' ? styles.negotiating : 
                                        offer.sellerAddress === walletAddress ? styles.waiting : ''
                                    }`}
                                >
                                    {offer.status === 'negotiating' && (
                                        <div className={styles.negotiatingOverlay}>
                                            <span>In Trade</span>
                                        </div>
                                    )}
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
                                        </div>
                                    </div>
                                    <div className={styles.offerActions}>
                                        {offer.sellerAddress === walletAddress ? (
                                            <>
                                                <span className={styles.offerWaitingText}>
                                                    Waiting for interested traders...
                                                </span>
                                                <button 
                                                    className={styles.offerCancelButton}
                                                    onClick={() => handleCancelOffer(offer.id)}
                                                >
                                                    Cancel
                                                </button>
                                            </>
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
                            <h3>ONLINE TRADERS {users.length}</h3>
                        </div>
                        <div className={styles.tradersList}>
                            {users.map((user, index) => {
                                // Mock data - REMOVE THIS LATER if real roles/chatting status comes from server
                                const mockUserData = {
                                    role: index === 0 && user.username === 'Allen' ? 'admin' : 
                                          index === 1 && user.username === 'HelperBot' ? 'helper' : 
                                          index === 2 && user.username === 'VIP_Player' ? 'vip' : undefined,
                                    isChatting: index === 4
                                };

                                // Generate dynamic class based on skin ID
                                const skinClass = user.equippedSkinId ? styles[`skin-${user.equippedSkinId.replace('_', '-')}`] : '';
                                const roleClass = mockUserData.role ? styles[mockUserData.role] : '';
                                const finalClassName = `${styles.traderItem} ${roleClass} ${skinClass}`.trim(); // Combine classes

                                return (
                                    <div 
                                        key={user.walletAddress} 
                                        className={finalClassName} // Apply combined class name
                                    >
                                        <span className={`${styles.traderStatus} ${styles.online}`} />
                                        {/* REMOVE SVG image and placeholder */}
                                        {/* {skinSvgPath ? (
                                            <img src={skinSvgPath} alt={`${user.username}'s skin`} className={styles.traderSkinSvg} />
                                        ) : (
                                            <div className={styles.traderSkinPlaceholder}></div> 
                                        )} */}
                                        <span className={styles.traderName}>{user.username}</span>
                                        {/* Keep mock chatting indicator */}
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

                            <div className={isTradeOfferer ? styles.offererTradeGrid : styles.partnerTradeGrid}>
                                {!isTradeOfferer ? (
                                    <>
                                        <div className={`${styles.partnerTradeSide} ${activeTradeNegotiation?.status === 'locked' ? styles.locked : ''}`}>
                                            <div className={styles.partnerTradeHeader}>
                                                <span>You give:</span>
                                            </div>
                                            <PartnerTradeItemGrid 
                                                items={activeTradeNegotiation?.status === 'locked' ? 
                                                    activeTradeNegotiation.yourItems || [] : 
                                                    selectedTradeItems}
                                                isLocked={activeTradeNegotiation?.status === 'locked'}
                                                onSlotClick={handleTradeSlotClick}
                                            />
                                            <div className={styles.tradeCoins}>
                                                and <span>0 Coins</span>
                                            </div>
                                        </div>
                                        <div className={styles.partnerTradeSide}>
                                            <div className={styles.partnerTradeHeader}>
                                                <span>Item:</span>
                                            </div>
                                            <PartnerTradeItemGrid 
                                                items={activeTradeNegotiation?.originalOfferItems || []}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.offererTradeSide}>
                                            <div className={styles.offererTradeHeader}>
                                                <span>Your Offer:</span>
                                            </div>
                                            <OffererTradeItemGrid 
                                                items={activeTradeNegotiation?.originalOfferItems || []}
                                            />
                                        </div>
                                        <div className={styles.offererTradeSide}>
                                            <div className={styles.offererTradeHeader}>
                                                <span>You Get:</span>
                                            </div>
                                            <OffererTradeItemGrid 
                                                items={activeTradeNegotiation?.partnerItems || []}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className={styles.tradeActions}>
                                {isTradeOfferer ? (
                                    <>
                                        {(() => {
                                            if (!activeTradeNegotiation || typeof activeTradeNegotiation.isPartnerLocked === 'undefined') {
                                                return <div>Loading...</div>; // Or some placeholder
                                            }

                                            const isPartnerLocked = activeTradeNegotiation.isPartnerLocked;

                                            if (isPartnerLocked) { // Buyer (Partner) is locked - Show Accept, Unlock, Reject
                                                return (
                                                    <>
                                                        <button className={styles.tradeAcceptButton} onClick={handleAcceptTrade}>
                                                            Accept Trade
                                                        </button>
                                                        <button className={styles.tradeUnlockButton} onClick={handleUnlockTrade}> 
                                                            Unlock Partner {/* Renamed for clarity */}
                                                        </button>
                                                        <button className={styles.tradeRejectButton} onClick={handleRejectTrade}>
                                                            Reject
                                                        </button>
                                                    </>
                                                );
                                            } else { // Buyer (Partner) is NOT locked - Show only Reject
                                                 return (
                                                     <button className={styles.tradeRejectButton} onClick={handleRejectTrade}>
                                                         Reject
                                                     </button>
                                                 );
                                            }
                                        })()}
                                    </>
                                ) : (
                                    <>
                                        {/* Buyer: Show Unlock if they are locked (by themselves) */}
                                        {activeTradeNegotiation.isLocked ? (
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
                                {isTradeOfferer ? (
                                    // Seller Status Messages - Revised Flow V2
                                    activeTradeNegotiation.isPartnerLocked ? 
                                        'Partner locked. Accept, Reject, or ask Partner to Unlock & Modify.' :
                                    'Waiting for partner to lock items...'
                                ) : (
                                    // Buyer Status Messages - Revised Flow V2
                                    activeTradeNegotiation.isLocked ? // Buyer is locked
                                        'You locked items. Waiting for seller response...' :
                                    // Buyer is not locked (initial state or after unlock)
                                    'Select items to trade and click OK, COOL!'
                                )}
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