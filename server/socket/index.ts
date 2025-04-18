import { Server as SocketServer, Socket } from 'socket.io';
import { wsPool } from '../websocket';
import { CHAT_CONFIG } from '../../config/chat';
import { Pool } from 'pg';

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
    sellerName: string;
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

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

// Add these helper functions at the top after the interfaces
const createTradeRecord = async (client: any, tradeId: string, sellerAddress: string, buyerAddress: string | null = null) => {
    await client.query(
        `INSERT INTO trade_history (trade_id, seller_address, buyer_address, status)
         VALUES ($1, $2, $3, CAST($4 AS VARCHAR(50)))`,
        [tradeId, sellerAddress.toLowerCase(), buyerAddress?.toLowerCase() || null, buyerAddress ? 'negotiating' : 'pending']
    );
};

const createTradeNegotiation = async (client: any, tradeId: string, sellerAddress: string, buyerAddress: string) => {
    await client.query(
        `INSERT INTO trade_negotiations (trade_id, seller_address, buyer_address, status)
         VALUES ($1, $2, $3, CAST($4 AS VARCHAR(50)))`,
        [tradeId, sellerAddress.toLowerCase(), buyerAddress.toLowerCase(), 'waiting']
    );
};

const updateTradeStatus = async (client: any, tradeId: string, status: string) => {
    await client.query(
        `UPDATE trade_history 
         SET status = CAST($1 AS VARCHAR(50)), 
             completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
         WHERE trade_id = $2`,
        [status, tradeId]
    );
};

const recordTradeItems = async (client: any, tradeId: string, items: any[], fromAddress: string, toAddress: string) => {
    for (const item of items) {
        // Extract the base item ID by removing any prefixes and timestamps
        const baseItemId = item.id.split('-')[0]  // Get the base item ID before any timestamp
            .replace(/^(locked-|your-|partner-|original-)*/g, ''); // Remove any prefixes

        // Verify the item exists in the items table
        const itemCheck = await client.query(
            'SELECT id FROM items WHERE id = $1',
            [baseItemId]
        );

        if (itemCheck.rows.length === 0) {
            throw new Error(`Item ${baseItemId} not found in items table`);
        }

        await client.query(
            `INSERT INTO trade_items (trade_id, item_id, from_address, to_address, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [tradeId, baseItemId, fromAddress.toLowerCase(), toAddress.toLowerCase(), 1]
        );
    }
};

const saveTradeChatMessage = async (client: any, tradeId: string, senderAddress: string, message: string) => {
    await client.query(
        `INSERT INTO trade_chat_messages (trade_id, sender_address, message)
         VALUES ($1, $2, $3)`,
        [tradeId, senderAddress.toLowerCase(), message]
    );
};

const updateInventoryForTrade = async (client: any, walletAddress: string, itemId: string, quantityChange: number) => {
    // Extract the base item ID
    const baseItemId = itemId.split('-')[0]
        .replace(/^(locked-|your-|partner-|original-)*/g, '');

    await client.query(
        `UPDATE player_inventories 
         SET quantity = quantity + $1
         WHERE wallet_address = $2 AND item_id = $3`,
        [quantityChange, walletAddress.toLowerCase(), baseItemId]
    );
};

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
        socket.on('makeTradeOffer', async (offer: TradeOffer) => {
            console.log('🟡 New trade offer received:', offer);
            const client = await wsPool.connect();
            
            try {
                await client.query('BEGIN');
                
                // First ensure the seller exists in the users table
                await client.query(
                    `INSERT INTO users (wallet_address, username)
                     VALUES ($1, $2)
                     ON CONFLICT (wallet_address) DO UPDATE
                     SET username = $2`,
                    [offer.offerer.toLowerCase(), offer.sellerName]
                );
                
                // Create the trade record without a buyer
                await createTradeRecord(client, offer.id, offer.offerer);
                
                activeOffers.push(offer);
                io.emit('newTradeOffer', offer);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to create trade offer:', error);
                socket.emit('error', 'Failed to create trade offer');
            } finally {
                client.release();
            }
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
        socket.on('tradeLock', async (data: { offerId: string; items: any[]; walletAddress: string }) => {
            const client = await wsPool.connect();
            console.log('🔒 SERVER: tradeLock received:', JSON.stringify(data, null, 2));

            try {
                await client.query('BEGIN');
                const negotiation = activeNegotiations.find(n => n.offerId === data.offerId);

                if (negotiation) {
                    const lockerAddress = data.walletAddress.toLowerCase();
                    const isSeller = negotiation.sellerAddress.toLowerCase() === lockerAddress;
                    const partnerAddress = isSeller ? negotiation.buyerAddress : negotiation.sellerAddress;

                    console.log(`🔒 SERVER: Processing lock for ${lockerAddress} (isSeller: ${isSeller}), Partner: ${partnerAddress}`);

                    // Update negotiation status in DB
                    await client.query(
                        `UPDATE trade_negotiations 
                         SET ${isSeller ? 'seller_locked' : 'buyer_locked'} = true
                         WHERE trade_id = $1`,
                        [data.offerId]
                    );

                    // Update in-memory negotiation state for items
                    const cleanedItems = data.items.map(item => ({
                        ...item,
                        id: item.id.replace(/^(locked-|your-|partner-|original-)*/g, '')
                    }));

                    if (isSeller) {
                        negotiation.sellerItems = cleanedItems;
                        console.log('🔒 SERVER: Updated sellerItems in memory:', negotiation.sellerItems);
                    } else {
                        negotiation.buyerItems = cleanedItems;
                        console.log('🔒 SERVER: Updated buyerItems in memory:', negotiation.buyerItems);
                    }
                    negotiation.status = 'locked'; // Assuming lock implies locked status until accept/cancel

                    // Find sockets for both parties
                    const locker = users.find(u => u.walletAddress === lockerAddress);
                    const partner = users.find(u => u.walletAddress === partnerAddress);

                    // Prepare data for locker
                    const lockerData = {
                        offerId: data.offerId,
                        status: 'locked',
                        yourItems: isSeller ? negotiation.sellerItems : negotiation.buyerItems,
                        partnerItems: isSeller ? negotiation.buyerItems : negotiation.sellerItems,
                        fromAddress: lockerAddress
                    };

                    // Prepare data for partner
                    const partnerData = {
                        offerId: data.offerId,
                        status: 'locked',
                        yourItems: isSeller ? negotiation.buyerItems : negotiation.sellerItems, // Partner's perspective
                        partnerItems: isSeller ? negotiation.sellerItems : negotiation.buyerItems, // Partner's perspective
                        fromAddress: lockerAddress
                    };

                    // Emit to locker
                    if (locker) {
                        console.log('🔒 SERVER: Emitting tradeLockUpdate to locker:', JSON.stringify(lockerData, null, 2));
                        io.to(locker.socketId).emit('tradeLockUpdate', lockerData);
                    }

                    // Emit to partner
                    if (partner) {
                         console.log('🔒 SERVER: Emitting tradeLockUpdate to partner:', JSON.stringify(partnerData, null, 2));
                        io.to(partner.socketId).emit('tradeLockUpdate', partnerData);
                    }
                }
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to lock trade:', error);
                socket.emit('error', 'Failed to lock trade');
            } finally {
                client.release();
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

        socket.on('tradeChatMessage', async (data: { offerId: string; message: TradeChatMessage }) => {
            const client = await wsPool.connect();
            
            try {
                await client.query('BEGIN');
                await saveTradeChatMessage(client, data.offerId, data.message.senderAddress, data.message.content);
                
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
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to save trade chat message:', error);
            } finally {
                client.release();
            }
        });

        // Update the acceptTradeOffer handler
        socket.on('acceptTradeOffer', async (data: { offerId: string; acceptedBy: string; acceptedByAddress: string }) => {
            console.log('🤝 Trade acceptance received:', data);
            const client = await wsPool.connect();
            
            try {
                await client.query('BEGIN');
                
                // First ensure the buyer exists in the users table
                await client.query(
                    `INSERT INTO users (wallet_address, username)
                     VALUES ($1, $2)
                     ON CONFLICT (wallet_address) DO UPDATE
                     SET username = $2`,
                    [data.acceptedByAddress.toLowerCase(), data.acceptedBy]
                );

                const offer = activeOffers.find(o => o.id === data.offerId);
                if (!offer) {
                    throw new Error('Trade offer not found');
                }

                // Update the trade record with the buyer
                await client.query(
                    `UPDATE trade_history 
                     SET buyer_address = $1, status = 'negotiating'
                     WHERE trade_id = $2`,
                    [data.acceptedByAddress.toLowerCase(), data.offerId]
                );

                // Create a new trade negotiation
                const negotiation: TradeNegotiation = {
                    offerId: offer.id,
                    buyerAddress: data.acceptedByAddress.toLowerCase(),
                    sellerAddress: offer.offerer.toLowerCase(),
                    status: 'waiting',
                    buyerItems: [],
                    sellerItems: [offer.item] // Include the original offered item
                };
                
                await createTradeNegotiation(client, data.offerId, offer.offerer, data.acceptedByAddress);
                
                // Add to active negotiations
                activeNegotiations.push(negotiation);
                
                // Remove from active offers
                activeOffers = activeOffers.filter(o => o.id !== data.offerId);
                
                // Find the seller and buyer socket IDs
                const seller = users.find(u => u.walletAddress.toLowerCase() === offer.offerer.toLowerCase());
                const buyer = users.find(u => u.walletAddress.toLowerCase() === data.acceptedByAddress.toLowerCase());
                
                if (seller && buyer) {
                    // Notify seller
                    io.to(seller.socketId).emit('tradeNegotiationStarted', {
                        offerId: data.offerId,
                        partnerName: data.acceptedBy,
                        partnerAddress: data.acceptedByAddress,
                        status: 'waiting',
                        yourItems: [offer.item], // Original offer items
                        partnerItems: [],
                        originalOfferItems: [offer.item],
                        isOfferer: true
                    });
                    
                    // Notify buyer
                    io.to(buyer.socketId).emit('tradeNegotiationStarted', {
                        offerId: data.offerId,
                        partnerName: seller.username,
                        partnerAddress: seller.walletAddress,
                        status: 'waiting',
                        yourItems: [],
                        partnerItems: [offer.item],
                        originalOfferItems: [offer.item],
                        isOfferer: false
                    });
                    
                    // Broadcast removal to all clients
                    io.emit('tradeOfferCancelled', data.offerId);
                } else {
                    throw new Error('One or both users not found');
                }
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to accept trade:', error);
                socket.emit('error', 'Failed to accept trade: ' + (error as Error).message);
            } finally {
                client.release();
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

        // Update the acceptTrade handler
        socket.on('acceptTrade', async (data: { offerId: string; acceptedBy: string; acceptedByAddress: string }) => {
            const client = await wsPool.connect();
            console.log('🤝 Processing trade acceptance:', data);
            
            try {
                await client.query('BEGIN');
                const negotiation = activeNegotiations.find(n => n.offerId === data.offerId);
                
                if (negotiation) {
                    console.log('Found negotiation:', {
                        buyerItems: negotiation.buyerItems,
                        sellerItems: negotiation.sellerItems
                    });

                    // Record final trade items
                    await recordTradeItems(client, data.offerId, negotiation.buyerItems, negotiation.buyerAddress, negotiation.sellerAddress);
                    await recordTradeItems(client, data.offerId, negotiation.sellerItems, negotiation.sellerAddress, negotiation.buyerAddress);
                    
                    // Process buyer's items (items buyer is giving to seller)
                    for (const item of negotiation.buyerItems) {
                        const baseItemId = item.id.split('-')[0].replace(/^(locked-|your-|partner-|original-)*/g, '');
                        console.log('Processing buyer item:', baseItemId);
                        
                        // Remove from buyer's inventory
                        await client.query(
                            `UPDATE player_inventories 
                             SET quantity = quantity - 1
                             WHERE wallet_address = $1 AND item_id = $2`,
                            [negotiation.buyerAddress.toLowerCase(), baseItemId]
                        );
                        
                        // Add to seller's inventory
                        await client.query(
                            `INSERT INTO player_inventories (wallet_address, item_id, quantity)
                             VALUES ($1, $2, 1)
                             ON CONFLICT (wallet_address, item_id) 
                             DO UPDATE SET quantity = player_inventories.quantity + 1`,
                            [negotiation.sellerAddress.toLowerCase(), baseItemId]
                        );
                    }
                    
                    // Process seller's items (items seller is giving to buyer)
                    for (const item of negotiation.sellerItems) {
                        const baseItemId = item.id.split('-')[0].replace(/^(locked-|your-|partner-|original-)*/g, '');
                        console.log('Processing seller item:', baseItemId);
                        
                        // Remove from seller's inventory
                        await client.query(
                            `UPDATE player_inventories 
                             SET quantity = quantity - 1
                             WHERE wallet_address = $1 AND item_id = $2`,
                            [negotiation.sellerAddress.toLowerCase(), baseItemId]
                        );
                        
                        // Add to buyer's inventory
                        await client.query(
                            `INSERT INTO player_inventories (wallet_address, item_id, quantity)
                             VALUES ($1, $2, 1)
                             ON CONFLICT (wallet_address, item_id) 
                             DO UPDATE SET quantity = player_inventories.quantity + 1`,
                            [negotiation.buyerAddress.toLowerCase(), baseItemId]
                        );
                    }
                    
                    // Update trade status
                    await updateTradeStatus(client, data.offerId, 'completed');
                    
                    // Get updated inventories for both parties
                    const buyerInventory = await client.query(
                        `SELECT item_id, quantity FROM player_inventories WHERE wallet_address = $1`,
                        [negotiation.buyerAddress.toLowerCase()]
                    );
                    
                    const sellerInventory = await client.query(
                        `SELECT item_id, quantity FROM player_inventories WHERE wallet_address = $1`,
                        [negotiation.sellerAddress.toLowerCase()]
                    );

                    console.log('Updated inventories:', {
                        buyer: buyerInventory.rows,
                        seller: sellerInventory.rows
                    });
                    
                    // Find the buyer and seller sockets
                    const buyer = users.find(u => u.walletAddress.toLowerCase() === negotiation.buyerAddress.toLowerCase());
                    const seller = users.find(u => u.walletAddress.toLowerCase() === negotiation.sellerAddress.toLowerCase());
                    
                    if (buyer && seller) {
                        // Emit completion events with updated inventories
                        io.to(buyer.socketId).emit('tradeCompleted', {
                            offerId: data.offerId,
                            receivedItems: negotiation.sellerItems,
                            givenItems: negotiation.buyerItems,
                            newInventory: Object.fromEntries(buyerInventory.rows.map(row => [row.item_id, row.quantity]))
                        });
                        
                        io.to(seller.socketId).emit('tradeCompleted', {
                            offerId: data.offerId,
                            receivedItems: negotiation.buyerItems,
                            givenItems: negotiation.sellerItems,
                            newInventory: Object.fromEntries(sellerInventory.rows.map(row => [row.item_id, row.quantity]))
                        });
                    }
                    
                    // Remove from active negotiations
                    activeNegotiations = activeNegotiations.filter(n => n.offerId !== data.offerId);
                }
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to complete trade:', error);
                socket.emit('tradeFailed', {
                    offerId: data.offerId,
                    error: 'Failed to complete trade: ' + (error as Error).message
                });
            } finally {
                client.release();
            }
        });
    });
}; 