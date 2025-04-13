import { Server as SocketServer, Socket } from 'socket.io';
import { wsPool } from '../websocket';
import { CHAT_CONFIG } from '../../config/chat';

interface User {
    walletAddress: string;
    username: string;
    socketId: string;
}

interface TradeOffer {
    id: string;
    offerer: string;
    partner: string;
    offererItems: any[];
    partnerItems: any[];
    offererSocketId: string;
    partnerSocketId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'locked' | 'waiting';
    timestamp: number;
    item: any;
}

interface TradeChatMessage {
    id: string;
    offerId: string;
    sender: string;
    senderAddress: string;
    content: string;
    timestamp: string;
}

interface TradeNegotiation {
    offerId: string;
    buyerAddress: string;
    sellerAddress: string;
    status: 'waiting' | 'locked' | 'cancelled' | 'completed';
    buyerItems: any[];
    sellerItems: any[];
}

let users: User[] = [];
let activeOffers: TradeOffer[] = [];
let activeNegotiations: TradeNegotiation[] = [];
let clearMessagesTimeout: NodeJS.Timeout | null = null;

// Rate limiting setup
const messageRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_MESSAGES_PER_WINDOW = 5;

export const setupSocket = (io: SocketServer) => {
    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        // Cancel any pending message cleanup when a user connect
        if (clearMessagesTimeout) {
            clearTimeout(clearMessagesTimeout);
            clearMessagesTimeout = null;
        }

        // Join handler
        socket.on('join', async (data: { walletAddress: string; username: string }) => {
            const { walletAddress, username } = data;
            const normalizedWalletAddress = walletAddress.toLowerCase();
            
            console.log('🟣 User joining:', username, 'Current active offers:', activeOffers);
            
            // Remove any existing connections for this user
            users = users.filter(user => user.walletAddress !== normalizedWalletAddress);
            
            // Add the new connection
            users.push({
                walletAddress: normalizedWalletAddress,
                username,
                socketId: socket.id
            });

            // Send current active offers to the new user
            socket.emit('activeOffers', activeOffers);
            console.log('🟣 Sent active offers to', username, ':', activeOffers);
            
            // Broadcast updated online users list
            io.emit('onlineUsers', users.map(u => u.username));
            
            console.log(`${username} joined the marketplace`);
        });

        // Message handler with rate limiting and DB persistence
        socket.on('message', async (data: { walletAddress: string; username: string; message: string }) => {
            const normalizedWalletAddress = data.walletAddress.toLowerCase();
            console.log('Attempting to save message for wallet:', normalizedWalletAddress);
            
            // Check rate limit
            const now = Date.now();
            const userLastMessage = messageRateLimit.get(normalizedWalletAddress) || 0;
            
            if (now - userLastMessage < RATE_LIMIT_WINDOW) {
                socket.emit('error', 'Please wait before sending another message');
                return;
            }
            
            messageRateLimit.set(normalizedWalletAddress, now);

            // Validate message
            if (!data.message || data.message.length > 500) {
                socket.emit('error', 'Invalid message');
                return;
            }

            let client;
            try {
                client = await wsPool.connect();
                
                // Check if user exists
                const userExists = await client.query(
                    'SELECT wallet_address FROM users WHERE wallet_address = LOWER($1)',
                    [normalizedWalletAddress]
                );

                if (userExists.rows.length === 0) {
                    // Create user if they don't exist
                    await client.query(
                        'INSERT INTO users (wallet_address, username) VALUES (LOWER($1), $2) ON CONFLICT (wallet_address) DO UPDATE SET username = $2',
                        [normalizedWalletAddress, data.username]
                    );
                }
                
                const result = await client.query(
                    `INSERT INTO chat_messages (sender_address, message)
                     VALUES (LOWER($1), $2)
                     RETURNING id, created_at;`,
                    [normalizedWalletAddress, data.message]
                );

                const newMessage = {
                    id: result.rows[0].id,
                    sender_address: normalizedWalletAddress,
                    sender_name: data.username,
                    message: data.message,
                    created_at: result.rows[0].created_at
                };

                io.emit('message', newMessage);
            } catch (error) {
                console.error('Database error:', error);
                socket.emit('error', 'Failed to save message');
            } finally {
                if (client) client.release();
            }
        });

        // Trade offer handlers
        socket.on('makeTradeOffer', (offer: TradeOffer) => {
            console.log('🟡 New trade offer received from', offer.offerer, ':', offer);
            
            // Add to active offers
            activeOffers.push(offer);
            console.log('🟡 Updated active offers:', activeOffers);
            
            // Broadcast to all clients including sender
            io.emit('newTradeOffer', offer);
        });

        socket.on('cancelTradeOffer', (offerId: string) => {
            console.log('🔴 Cancelling trade offer:', offerId);
            const offerToCancel = activeOffers.find(o => o.id === offerId);
            
            if (offerToCancel) {
                console.log('🔴 Found offer to cancel:', offerToCancel);
                activeOffers = activeOffers.filter(offer => offer.id !== offerId);
                // Broadcast the cancellation to all users
                io.emit('tradeOfferCancelled', offerId);
                console.log('🔴 Updated active offers after cancel:', activeOffers);
            }
        });

        // Trade negotiation handlers
        socket.on('tradeLock', (data: { offerId: string; items: any[]; walletAddress: string }) => {
            console.log('🔒 Trade lock received:', data);
            const negotiation = activeNegotiations.find(n => n.offerId === data.offerId);
            
            if (negotiation) {
                // Update negotiation status
                negotiation.status = 'locked';
                
                // Clean the items by removing any existing prefixes and standardizing IDs
                const cleanedItems = data.items.map(item => ({
                    ...item,
                    id: item.id.replace(/^(locked-|your-)*/g, '') // Remove any existing prefixes
                }));
                
                // Store the items being offered
                const isFromBuyer = negotiation.buyerAddress.toLowerCase() === data.walletAddress.toLowerCase();
                if (isFromBuyer) {
                    negotiation.buyerItems = cleanedItems;
                } else {
                    negotiation.sellerItems = cleanedItems;
                }
                
                // Notify both parties
                const seller = users.find(u => u.walletAddress === negotiation.sellerAddress);
                const buyer = users.find(u => u.walletAddress === negotiation.buyerAddress);
                
                // For seller's view
                if (seller) {
                    io.to(seller.socketId).emit('tradeLockUpdate', {
                        offerId: data.offerId,
                        status: 'locked',
                        items: isFromBuyer ? cleanedItems : negotiation.sellerItems,
                        fromAddress: data.walletAddress,
                        partnerItems: isFromBuyer ? negotiation.sellerItems : cleanedItems
                    });
                }
                
                // For buyer's view
                if (buyer) {
                    io.to(buyer.socketId).emit('tradeLockUpdate', {
                        offerId: data.offerId,
                        status: 'locked',
                        items: isFromBuyer ? negotiation.buyerItems : cleanedItems,
                        fromAddress: data.walletAddress,
                        partnerItems: isFromBuyer ? cleanedItems : negotiation.buyerItems
                    });
                }
            }
        });

        socket.on('tradeUnlock', (data: { offerId: string; walletAddress: string; items: any[] }) => {
            console.log('🔓 Trade unlock received:', data);
            const negotiation = activeNegotiations.find(n => n.offerId === data.offerId);
            
            if (negotiation) {
                // Update negotiation status
                negotiation.status = 'waiting';
                
                // Clean the items by removing any existing prefixes
                const cleanedItems = data.items.map(item => ({
                    ...item,
                    id: item.id.replace(/^(locked-|your-)*/g, '') // Remove any existing prefixes
                }));
                
                // Update the items based on who unlocked
                const isFromBuyer = negotiation.buyerAddress.toLowerCase() === data.walletAddress.toLowerCase();
                if (isFromBuyer) {
                    negotiation.buyerItems = cleanedItems;
                } else {
                    negotiation.sellerItems = cleanedItems;
                }

                // Notify both parties
                const seller = users.find(u => u.walletAddress === negotiation.sellerAddress);
                const buyer = users.find(u => u.walletAddress === negotiation.buyerAddress);
                
                // For seller's view
                if (seller) {
                    io.to(seller.socketId).emit('tradeLockUpdate', {
                        offerId: data.offerId,
                        status: 'waiting',
                        items: isFromBuyer ? cleanedItems : negotiation.sellerItems,
                        fromAddress: data.walletAddress,
                        partnerItems: isFromBuyer ? negotiation.sellerItems : cleanedItems
                    });
                }
                
                // For buyer's view
                if (buyer) {
                    io.to(buyer.socketId).emit('tradeLockUpdate', {
                        offerId: data.offerId,
                        status: 'waiting',
                        items: isFromBuyer ? negotiation.buyerItems : cleanedItems,
                        fromAddress: data.walletAddress,
                        partnerItems: isFromBuyer ? cleanedItems : negotiation.buyerItems
                    });
                }
            }
        });

        socket.on('tradeChatMessage', (data: { offerId: string; message: TradeChatMessage }) => {
            console.log('💬 Trade chat message received:', data);
            const negotiation = activeNegotiations.find(n => n.offerId === data.offerId);
            
            if (negotiation) {
                // Broadcast to everyone in the trade negotiation including sender
                const seller = users.find(u => u.walletAddress.toLowerCase() === negotiation.sellerAddress.toLowerCase());
                const buyer = users.find(u => u.walletAddress.toLowerCase() === negotiation.buyerAddress.toLowerCase());
                
                if (seller) {
                    io.to(seller.socketId).emit('tradeChatMessage', data.message);
                }
                
                if (buyer) {
                    io.to(buyer.socketId).emit('tradeChatMessage', data.message);
                }
            }
        });

        // Update the acceptTradeOffer handler to initialize a trade negotiation
        socket.on('acceptTradeOffer', (data: { offerId: string; acceptedBy: string; acceptedByAddress: string }) => {
            console.log('🤝 Trade acceptance received:', data);
            const offer = activeOffers.find(o => o.id === data.offerId);
            
            if (offer) {
                // Create a new trade negotiation
                const negotiation: TradeNegotiation = {
                    offerId: offer.id,
                    buyerAddress: data.acceptedByAddress.toLowerCase(),
                    sellerAddress: offer.offerer.toLowerCase(),
                    status: 'waiting',
                    buyerItems: [],
                    sellerItems: [offer.item] // Include the original offered item
                };
                
                activeNegotiations.push(negotiation);
                
                // Find the seller and buyer socket IDs
                const seller = users.find(u => u.walletAddress.toLowerCase() === offer.offerer.toLowerCase());
                const buyer = users.find(u => u.walletAddress.toLowerCase() === data.acceptedByAddress.toLowerCase());
                
                if (seller && buyer) {
                    // Notify both parties
                    io.to(seller.socketId).emit('tradeNegotiationStarted', {
                        ...negotiation,
                        partnerName: data.acceptedBy,
                        partnerAddress: data.acceptedByAddress
                    });
                    
                    io.to(buyer.socketId).emit('tradeNegotiationStarted', {
                        ...negotiation,
                        partnerName: seller.username,
                        partnerAddress: seller.walletAddress
                    });
                    
                    // Remove the offer from active offers
                    activeOffers = activeOffers.filter(o => o.id !== data.offerId);
                    io.emit('tradeOfferCancelled', data.offerId); // Broadcast removal to all clients
                }
            }
        });

        // Update disconnect handler to clean up negotiations
        socket.on('disconnect', async () => {
            const user = users.find(u => u.socketId === socket.id);
            if (user) {
                console.log(`${user.username} disconnected`);
                // Remove user from users array
                users = users.filter(u => u.socketId !== socket.id);
                // Remove their active offers
                activeOffers = activeOffers.filter(offer => offer.partner !== user.walletAddress);
                // Remove their active negotiations
                const userNegotiations = activeNegotiations.filter(
                    n => n.buyerAddress === user.walletAddress || n.sellerAddress === user.walletAddress
                );
                
                // Notify other parties in negotiations that the user disconnected
                userNegotiations.forEach(negotiation => {
                    const otherPartyAddress = negotiation.buyerAddress === user.walletAddress 
                        ? negotiation.sellerAddress 
                        : negotiation.buyerAddress;
                    
                    const otherParty = users.find(u => u.walletAddress === otherPartyAddress);
                    if (otherParty) {
                        io.to(otherParty.socketId).emit('tradeNegotiationCancelled', {
                            offerId: negotiation.offerId,
                            reason: 'User disconnected'
                        });
                    }
                });
                
                activeNegotiations = activeNegotiations.filter(
                    n => n.buyerAddress !== user.walletAddress && n.sellerAddress !== user.walletAddress
                );
                
                // Broadcast updated online users list
                io.emit('onlineUsers', users.map(u => u.username));
            }
        });

        // Inside the setupSocket function, after the existing trade-related events
        socket.on('lockTrade', (offerId: string) => {
            const offer = activeOffers.find(o => o.id === offerId);
            if (offer) {
                offer.status = 'locked';
                // Notify both parties
                io.to(offer.offererSocketId).emit('tradeLocked', offerId);
                io.to(offer.partnerSocketId).emit('tradeLocked', offerId);
            }
        });

        socket.on('unlockTrade', (offerId: string) => {
            const offer = activeOffers.find(o => o.id === offerId);
            if (offer) {
                offer.status = 'waiting';
                // Notify both parties
                io.to(offer.offererSocketId).emit('tradeUnlocked', offerId);
                io.to(offer.partnerSocketId).emit('tradeUnlocked', offerId);
            }
        });
    });
}; 