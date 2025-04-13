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
    sellerName: string;
    sellerAddress: string;
    item: any; // Replace with proper Item type
    timestamp: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

let users: User[] = [];
let activeOffers: TradeOffer[] = [];
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
            console.log('🟡 New trade offer received from', offer.sellerName, ':', offer);
            
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

        socket.on('acceptTradeOffer', (data: { offerId: string; acceptedBy: string; acceptedByAddress: string }) => {
            console.log('Trade offer accepted:', data);
            const offer = activeOffers.find(o => o.id === data.offerId);
            
            if (offer) {
                // Update offer status
                offer.status = 'accepted';
                
                // Notify both parties
                const seller = users.find(u => u.walletAddress === offer.sellerAddress);
                const buyer = users.find(u => u.walletAddress === data.acceptedByAddress);
                
                if (seller) {
                    io.to(seller.socketId).emit('tradeOfferAccepted', {
                        offerId: data.offerId,
                        acceptedBy: data.acceptedBy
                    });
                }
                
                if (buyer) {
                    io.to(buyer.socketId).emit('tradeOfferAccepted', {
                        offerId: data.offerId,
                        acceptedBy: data.acceptedBy
                    });
                }

                // Remove the offer from active offers
                activeOffers = activeOffers.filter(o => o.id !== data.offerId);
                
                // Broadcast the acceptance to all users
                io.emit('tradeOfferAccepted', {
                    offerId: data.offerId,
                    acceptedBy: data.acceptedBy
                });
            }
        });

        // Disconnect handler
        socket.on('disconnect', async () => {
            const user = users.find(u => u.socketId === socket.id);
            if (user) {
                console.log(`${user.username} disconnected`);
                // Remove user from users array
                users = users.filter(u => u.socketId !== socket.id);
                // Remove their active offers
                activeOffers = activeOffers.filter(offer => offer.sellerAddress !== user.walletAddress);
                // Broadcast updated online users list
                io.emit('onlineUsers', users.map(u => u.username));

                // If no users left, start cleanup timer
                if (users.length === 0) {
                    clearMessagesTimeout = setTimeout(async () => {
                        let client;
                        try {
                            client = await wsPool.connect();
                            
                            // Keep last 100 messages in main table
                            await client.query(`
                                WITH moved_messages AS (
                                    DELETE FROM chat_messages 
                                    WHERE id NOT IN (
                                        SELECT id FROM chat_messages 
                                        ORDER BY created_at DESC 
                                        LIMIT 100
                                    )
                                    RETURNING *
                                )
                                INSERT INTO chat_messages_archive 
                                SELECT * FROM moved_messages;
                            `);

                            console.log('Chat messages archived due to room being empty');
                        } catch (error) {
                            console.error('Error archiving messages:', error);
                        } finally {
                            if (client) client.release();
                        }
                    }, CHAT_CONFIG.EMPTY_ROOM_CLEANUP_DELAY);
                }
            }
        });
    });
}; 