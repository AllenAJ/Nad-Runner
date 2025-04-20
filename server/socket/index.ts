import { Server as SocketServer, Socket } from 'socket.io';
import { wsPool } from '../websocket';
import { CHAT_CONFIG } from '../../config/chat';
import { Pool } from 'pg';

interface User {
    walletAddress: string;
    username: string;
    socketId: string;
    equippedSkinId: string | null;
    level: number | string | null;
}

interface TradeOffer {
    id: string;
    offerer: string;
    partner: string;
    offererItems: any[];
    partnerItems: any[];
    offererSocketId: string;
    partnerSocketId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'locked' | 'waiting' | 'negotiating';
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

interface ValidatedTradeItem {
    id: string;
    quantity: number;
    verified: boolean;
    name: string;
    imageUrl: string;
    rarity: string;
    subCategory: string;
}

let users: User[] = [];
let activeOffers: TradeOffer[] = [];
let clearMessagesTimeout: NodeJS.Timeout | null = null;

// Rate limiting setup
const messageRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_MESSAGES_PER_WINDOW = 5;

// Add rate limiting setup near the top, after other rate limiting declarations
const tradeActionRateLimit = new Map<string, {
    lastAction: number,
    actionCount: number
}>();
const TRADE_RATE_LIMIT_WINDOW = 2000; // 2 seconds
const MAX_TRADE_ACTIONS_PER_WINDOW = 3;

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
        // Remove potential prefixes first, then handle potential timestamps/suffixes if needed
        let baseItemId = item.id.replace(/^(locked-|your-|partner-|original-)*/g, ''); 
        // If there are other suffixes like timestamps (e.g., itemid-12345), split and take the first part
        baseItemId = baseItemId.split('-')[0]; 

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

// Add helper function for trade rate limiting
const isTradeActionRateLimited = (walletAddress: string): boolean => {
    const now = Date.now();
    const userActions = tradeActionRateLimit.get(walletAddress) || { lastAction: 0, actionCount: 0 };
    
    if (now - userActions.lastAction > TRADE_RATE_LIMIT_WINDOW) {
        // Reset if window expired
        tradeActionRateLimit.set(walletAddress, { lastAction: now, actionCount: 1 });
        return false;
    }

    if (userActions.actionCount >= MAX_TRADE_ACTIONS_PER_WINDOW) {
        return true;
    }

    // Increment action count
    tradeActionRateLimit.set(walletAddress, {
        lastAction: userActions.lastAction,
        actionCount: userActions.actionCount + 1
    });
    return false;
};

// Add these validation functions after the existing helper functions
const validateTradeItems = async (
    client: any, 
    walletAddress: string, 
    items: any[]
): Promise<ValidatedTradeItem[]> => {
    const validatedItems: ValidatedTradeItem[] = [];
    
    for (const item of items) {
        // Extract base item ID - fix the splitting logic
        const baseItemId = item.id.replace(/^locked-/, ''); // Just remove the 'locked-' prefix
        
        console.log('Validating item:', {
            original: item.id,
            baseItemId: baseItemId,
            walletAddress: walletAddress
        });

        // Check inventory
        const inventory = await client.query(
            `SELECT pi.quantity, i.name, i.image_url, i.rarity, i.sub_category 
             FROM player_inventories pi
             JOIN items i ON i.id = pi.item_id
             WHERE pi.wallet_address = $1 AND pi.item_id = $2`,
            [walletAddress.toLowerCase(), baseItemId]
        );
        
        if (!inventory.rows[0] || inventory.rows[0].quantity < 1) {
            throw new Error(`Item ${baseItemId} not available in inventory`);
        }

        // Count how many times this item is already in validatedItems
        const existingCount = validatedItems.filter(
            vItem => vItem.id.replace(/^locked-/, '') === baseItemId
        ).length;

        // Check if adding another one would exceed inventory
        if (existingCount + 1 > inventory.rows[0].quantity) {
            throw new Error(`Not enough ${baseItemId} available in inventory (have ${inventory.rows[0].quantity}, trying to use ${existingCount + 1})`);
        }
        
        // Create validated item with the original prefix preserved
        validatedItems.push({
            id: item.id, // Keep the original ID with prefix
            quantity: 1,
            verified: true,
            name: inventory.rows[0].name,
            imageUrl: inventory.rows[0].image_url,
            rarity: inventory.rows[0].rarity,
            subCategory: inventory.rows[0].sub_category
        });
    }
    
    return validatedItems;
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
            
            // --- Fetch Equipped Skin & Level --- 
            let equippedSkinId: string | null = null;
            let level: number | string | null = null;
            let client;
            try {
                client = await wsPool.connect();
                // Query both inventory and profile
                const userDataRes = await client.query(
                    `SELECT 
                        (SELECT pi.item_id 
                         FROM player_inventories pi JOIN items i ON pi.item_id = i.id 
                         WHERE pi.wallet_address = $1 AND pi.equipped = TRUE AND i.sub_category = 'skin' LIMIT 1) as skin_id, 
                        (SELECT pp.level FROM player_profiles pp WHERE pp.wallet_address = $1 LIMIT 1) as player_level
                    `,
                    [normalizedWalletAddress]
                );

                if (userDataRes.rows.length > 0) {
                    equippedSkinId = userDataRes.rows[0].skin_id;
                    level = userDataRes.rows[0].player_level;
                    console.log(`🟣 Found user data for ${username}: Skin=${equippedSkinId}, Level=${level}`);

                    // --- Special Badge Logic --- 
                    const targetAdminAddress = '0xdcdcc0643f2b7336030cd46fde8bc00c8ea74547';
                    if (normalizedWalletAddress === targetAdminAddress) {
                        level = 'A'; // Override level for the specific address
                        console.log(`🟣 Overriding level to 'A' for admin user ${username}`);
                    }
                    // --- End Special Badge Logic ---

                } else {
                     console.log(`🟣 No profile/inventory data found for ${username}`);
                }
            } catch (dbError) {
                console.error(`Error fetching equipped skin for ${username}:`, dbError);
            } finally {
                if (client) client.release();
            }
            // --- End Fetch Skin --- 
            
            // Remove any existing connections for this user
            users = users.filter(user => user.walletAddress !== normalizedWalletAddress);
            
            // Add the new connection
            users.push({
                walletAddress: normalizedWalletAddress,
                username,
                socketId: socket.id,
                equippedSkinId,
                level
            });

            // Send current active offers to the new user
            socket.emit('activeOffers', activeOffers);
            console.log('🟣 Sent active offers to', username, ':', activeOffers);
            
            // Broadcast updated online users list (with skin info)
            io.emit('onlineUsers', users.map(u => ({ 
                username: u.username,
                walletAddress: u.walletAddress, 
                equippedSkinId: u.equippedSkinId,
                level: u.level
            })));
            
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
                socket.emit('serverAlert', { message: 'Please wait before sending another message', type: 'warning' });
                return;
            }
            
            messageRateLimit.set(normalizedWalletAddress, now);

            // Validate message
            if (!data.message || data.message.length > 500) {
                socket.emit('serverAlert', { message: 'Invalid message format or length', type: 'warning' });
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
                console.error('Database error saving message:', error);
                socket.emit('serverAlert', { message: 'Failed to send message due to server error.', type: 'error' });
            } finally {
                if (client) client.release();
            }
        });

        // Trade offer handlers
        socket.on('makeTradeOffer', async (offer: TradeOffer) => {
            // Add rate limit check
            if (isTradeActionRateLimited(offer.offerer.toLowerCase())) {
                socket.emit('serverAlert', { message: 'Please wait before performing more trade actions', type: 'warning' });
                return;
            }
            
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
                socket.emit('serverAlert', { message: 'Failed to create trade offer', type: 'error' });
            } finally {
                client.release();
            }
        });

        socket.on('cancelTradeOffer', (offerId: string) => {
            const offer = activeOffers.find(o => o.id === offerId);
            if (!offer) return;

            // --- ADD Rate Limit Check --- 
            if (isTradeActionRateLimited(offer.offerer.toLowerCase())) {
                socket.emit('serverAlert', { message: 'Please wait before performing more trade actions', type: 'warning' });
                return;
            }
            // --- END Check ---
            
            console.log('🔴 Cancelling trade offer:', offerId);
            activeOffers = activeOffers.filter(offer => offer.id !== offerId);
            // Broadcast the cancellation to all users
            io.emit('tradeOfferCancelled', offerId);
            console.log('🔴 Updated active offers after cancel:', activeOffers);
        });

        // Trade negotiation handlers
        socket.on('tradeLock', async (data: { offerId: string; items: any[]; walletAddress: string }) => {
            if (isTradeActionRateLimited(data.walletAddress.toLowerCase())) {
                socket.emit('serverAlert', { 
                    message: 'Please wait before performing more trade actions', 
                    type: 'warning' 
                });
                return;
            }
            
            const client = await wsPool.connect();
            console.log('🔒 SERVER: tradeLock received:', JSON.stringify(data, null, 2));

            try {
                await client.query('BEGIN');

                // --- Fetch current negotiation state from DB ---
                const negotiationRes = await client.query(
                    `SELECT seller_address, buyer_address, status, seller_locked, buyer_locked, seller_items, buyer_items 
                     FROM trade_negotiations 
                     WHERE trade_id = $1 FOR UPDATE`,
                    [data.offerId]
                );

                if (negotiationRes.rows.length === 0) {
                    throw new Error('Trade negotiation not found in database for locking.');
                }
                let negotiationState = negotiationRes.rows[0]; // Use let as we modify it
                // --- End Fetch ---

                    const lockerAddress = data.walletAddress.toLowerCase();
                const isSeller = negotiationState.seller_address.toLowerCase() === lockerAddress;
                // Seller should not lock in this flow
                if (isSeller) {
                    console.warn(`Seller (${lockerAddress}) attempted to lock items. Ignoring.`);
                    await client.query('ROLLBACK');
                    return; 
                }

                // Buyer is locking
                console.log('Validating items for BUYER address:', lockerAddress);
                const validatedItems = await validateTradeItems(client, lockerAddress, data.items);
                console.log('Buyer items validated successfully:', validatedItems);
                
                // --- Update DB State ---
                const newStatus = 'waiting'; // Remains waiting until seller accepts
                const buyerLocked = true;
                const sellerLocked = false; // Seller doesn't lock

                // *** ADD LOGGING BEFORE UPDATE ***
                console.log(`🔒 tradeLock: Updating DB for ${data.offerId} with buyer_items:`, JSON.stringify(validatedItems));

                const updateRes = await client.query(
                        `UPDATE trade_negotiations 
                     SET buyer_locked = $1,
                         buyer_items = $2::jsonb,
                         seller_locked = $3,
                         status = $4, 
                         updated_at = CURRENT_TIMESTAMP
                     WHERE trade_id = $5
                     RETURNING seller_address, buyer_address, status, seller_locked, buyer_locked, seller_items, buyer_items`, // Return updated state
                    [buyerLocked, JSON.stringify(validatedItems), sellerLocked, newStatus, data.offerId]
                );
                
                if (updateRes.rows.length === 0) {
                    throw new Error('Failed to update trade negotiation in database.');
                }
                negotiationState = updateRes.rows[0]; // Use the returned updated state
                // --- End DB Update ---

                // *** ADD LOGGING AFTER UPDATE ***
                console.log(`🔒 tradeLock: State returned from DB update for ${data.offerId}:`, JSON.stringify(negotiationState));

                    // Find sockets for both parties
                    const locker = users.find(u => u.walletAddress === lockerAddress);
                const partner = users.find(u => u.walletAddress === negotiationState.seller_address.toLowerCase()); // Seller is partner

                // --- Prepare Emission Data based on DB State ---
                const lockerData = { // Data for BUYER
                        offerId: data.offerId,
                    status: negotiationState.status,
                    yourItems: negotiationState.buyer_items, 
                    partnerItems: negotiationState.seller_items, // Seller's original items
                    fromAddress: lockerAddress,
                    locked: negotiationState.buyer_locked, // Buyer is locked
                    partnerLocked: negotiationState.seller_locked // Seller is not locked
                };

                const partnerData = { // Data for SELLER
                        offerId: data.offerId,
                    status: negotiationState.status,
                    yourItems: negotiationState.seller_items, // Seller's original items
                    partnerItems: negotiationState.buyer_items, // Buyer's locked items
                    fromAddress: lockerAddress,
                    locked: negotiationState.seller_locked, // Seller is not locked
                    partnerLocked: negotiationState.buyer_locked // Buyer (partner) is locked
                };
                // --- End Emission Data Prep ---

                // Log the state before emitting
                console.log('🔒 Trade state before emit:', {
                    tradeState: negotiationState,
                    lockerData,
                    partnerData
                });

                // Emit to both parties
                    if (locker) {
                        console.log('🔒 SERVER: Emitting tradeLockUpdate to locker:', JSON.stringify(lockerData, null, 2));
                        io.to(locker.socketId).emit('tradeLockUpdate', lockerData);
                    }

                    if (partner) {
                         console.log('🔒 SERVER: Emitting tradeLockUpdate to partner:', JSON.stringify(partnerData, null, 2));
                        io.to(partner.socketId).emit('tradeLockUpdate', partnerData);
                    }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to lock trade:', error);
                socket.emit('serverAlert', { 
                    message: 'Failed to lock trade: ' + (error as Error).message, 
                    type: 'error' 
                });
            } finally {
                client.release();
            }
        });

        socket.on('tradeUnlock', async (data: { offerId: string; walletAddress: string; items: any[] }) => {
            if (isTradeActionRateLimited(data.walletAddress.toLowerCase())) {
                socket.emit('serverAlert', { 
                    message: 'Please wait before performing more trade actions', 
                    type: 'warning' 
                });
                return;
            }
            
            const client = await wsPool.connect();
            console.log('🔓 Trade unlock received:', data);

            try {
                await client.query('BEGIN');

                // --- Fetch current negotiation state from DB ---
                const negotiationRes = await client.query(
                    `SELECT seller_address, buyer_address, status, seller_locked, buyer_locked, seller_items, buyer_items 
                     FROM trade_negotiations 
                     WHERE trade_id = $1 FOR UPDATE`,
                    [data.offerId]
                );

                if (negotiationRes.rows.length === 0) {
                    throw new Error('Trade negotiation not found in database for unlocking.');
                }
                let negotiationState = negotiationRes.rows[0];
                // --- End Fetch ---

                const unlockerAddress = data.walletAddress.toLowerCase();
                const isSeller = negotiationState.seller_address.toLowerCase() === unlockerAddress;

                let newBuyerLocked = negotiationState.buyer_locked;
                let resetBuyerItems = false;

                // Determine who needs unlocking based on requestor
                if (isSeller) {
                    // Seller requested unlock -> unlock the BUYER
                    console.log(`Seller (${unlockerAddress}) requested unlock for Buyer (${negotiationState.buyer_address})`);
                    newBuyerLocked = false;
                    // Don't reset buyer items when seller unlocks partner
                } else if (unlockerAddress === negotiationState.buyer_address.toLowerCase()) {
                    // Buyer requested unlock (themselves)
                    console.log(`Buyer (${unlockerAddress}) requested unlock for themselves`);
                    newBuyerLocked = false;
                    resetBuyerItems = true; // Clear items when buyer unlocks themselves
                } else {
                    // Someone unrelated tried to unlock? Error.
                    throw new Error(`User ${unlockerAddress} is not part of this trade and cannot unlock.`);
                }

                // Update trade state in DB
                const newStatus = 'waiting';
                const newSellerLocked = false; // Seller is never locked

                const updateRes = await client.query(
                    `UPDATE trade_negotiations 
                     SET status = $1,
                         seller_locked = $2, 
                         buyer_locked = $3,
                         buyer_items = CASE WHEN $4 THEN '[]'::jsonb ELSE buyer_items END, -- Reset buyer items only if buyer unlocked
                         updated_at = CURRENT_TIMESTAMP
                     WHERE trade_id = $5
                     RETURNING seller_address, buyer_address, status, seller_locked, buyer_locked, seller_items, buyer_items`, // Return updated state
                    [
                        newStatus,
                        newSellerLocked, 
                        newBuyerLocked,
                        resetBuyerItems, // Pass flag to query
                        data.offerId 
                    ]
                );

                if (updateRes.rows.length === 0) {
                    throw new Error('Failed to update trade negotiation during unlock.');
                }
                negotiationState = updateRes.rows[0]; // Use the returned updated state

                // --- Prepare Emission Data based on DB State ---
                const sellerData = {
                    offerId: data.offerId,
                    status: negotiationState.status,
                    yourItems: negotiationState.seller_items, 
                    partnerItems: negotiationState.buyer_items,
                    fromAddress: unlockerAddress,
                    locked: negotiationState.seller_locked, // Always false for seller
                    partnerLocked: negotiationState.buyer_locked // Reflects buyer's new state
                };

                const buyerData = {
                    offerId: data.offerId,
                    status: negotiationState.status,
                    yourItems: negotiationState.buyer_items, 
                    partnerItems: negotiationState.seller_items,
                    fromAddress: unlockerAddress,
                    locked: negotiationState.buyer_locked, // Reflects buyer's new state
                    partnerLocked: negotiationState.seller_locked // Always false for seller
                };
                // --- End Emission Data Prep ---

                // Notify both parties
                const seller = users.find(u => u.walletAddress === negotiationState.seller_address.toLowerCase());
                const buyer = users.find(u => u.walletAddress === negotiationState.buyer_address.toLowerCase());
                
                if (seller) {
                    io.to(seller.socketId).emit('tradeLockUpdate', sellerData);
                }

                if (buyer) {
                    io.to(buyer.socketId).emit('tradeLockUpdate', buyerData);
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to unlock trade:', error);
                socket.emit('serverAlert', { 
                    message: 'Failed to unlock trade: ' + (error as Error).message, 
                    type: 'error' 
                });
            } finally {
                client.release();
            }
        });

        socket.on('tradeChatMessage', async (data: { offerId: string; message: TradeChatMessage }) => {
            const client = await wsPool.connect();
            
            try {
                await client.query('BEGIN');
                await saveTradeChatMessage(client, data.offerId, data.message.senderAddress, data.message.content);
                
                // Fetch negotiation details to find participants
                const negotiationRes = await client.query(
                    `SELECT seller_address, buyer_address 
                     FROM trade_negotiations 
                     WHERE trade_id = $1 AND status = 'waiting'`,
                    [data.offerId]
                );
                
                if (negotiationRes.rows.length > 0) {
                    const negotiationState = negotiationRes.rows[0];
                    // Broadcast to everyone in the trade negotiation including sender
                    const seller = users.find(u => u.walletAddress.toLowerCase() === negotiationState.seller_address.toLowerCase());
                    const buyer = users.find(u => u.walletAddress.toLowerCase() === negotiationState.buyer_address.toLowerCase());
                    
                    if (seller) {
                        io.to(seller.socketId).emit('tradeChatMessage', data.message);
                    }
                    
                    if (buyer) {
                        io.to(buyer.socketId).emit('tradeChatMessage', data.message);
                    }
                } else {
                    console.log(`Trade negotiation ${data.offerId} not active, message not broadcasted.`);
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
            // Add rate limit check
            if (isTradeActionRateLimited(data.acceptedByAddress.toLowerCase())) {
                socket.emit('serverAlert', { message: 'Please wait before performing more trade actions', type: 'warning' });
                return;
            }
            
            console.log('🤝 Trade acceptance received:', data);
            const client = await wsPool.connect();
            
            try {
                await client.query('BEGIN');
                
                // --- Check and Lock Trade History Record ---
                const historyRes = await client.query(
                    `SELECT status FROM trade_history WHERE trade_id = $1 FOR UPDATE`,
                    [data.offerId]
                );

                if (historyRes.rows.length === 0) {
                    throw new Error('Original trade offer record not found.');
                }
                if (historyRes.rows[0].status !== 'pending') {
                    socket.emit('serverAlert', { message: 'Trade offer is no longer available or already being negotiated.', type: 'warning' });
                    throw new Error(`Trade offer ${data.offerId} is not in pending state (current: ${historyRes.rows[0].status}).`);
                }
                // --- End Check ---

                // Update history status first
                await client.query(
                    `UPDATE trade_history SET status = 'negotiating', buyer_address = $1 WHERE trade_id = $2`,
                    [data.acceptedByAddress.toLowerCase(), data.offerId]
                );

                // Find original offer details from activeOffers (needed for item info)
                const offer = activeOffers.find(o => o.id === data.offerId);
                if (!offer) {
                    // This *shouldn't* happen if history check passed, but good safeguard
                    throw new Error('Offer details not found in active memory despite history check.');
                }

                // Create a new trade negotiation with the original offer items
                const negotiation: TradeNegotiation = {
                    offerId: offer.id,
                    buyerAddress: data.acceptedByAddress.toLowerCase(),
                    sellerAddress: offer.offerer.toLowerCase(),
                    status: 'waiting',
                    buyerItems: [],
                    sellerItems: [offer.item] // Initialize with the original offer item
                };
                
                await createTradeNegotiation(client, data.offerId, offer.offerer, data.acceptedByAddress);
                
                // --- ADDED: Update the new record with the initial seller item ---
                await client.query(
                    `UPDATE trade_negotiations SET seller_items = $1::jsonb WHERE trade_id = $2`,
                    [JSON.stringify([offer.item]), data.offerId] // Store the item in an array
                );
                // --- END ADDED ---

                // Initialize trade state
                const tradeState = {
                    offerId: offer.id,
                    sellerAddress: offer.offerer.toLowerCase(),
                    buyerAddress: data.acceptedByAddress.toLowerCase(),
                    sellerItems: [offer.item],
                    buyerItems: [],
                    sellerLocked: false,
                    buyerLocked: false,
                    status: 'waiting',
                    timestamp: Date.now()
                };
                
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
                        yourItems: [offer.item],
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
                    
                    // Broadcast offer status update to all clients
                    io.emit('offerStatusUpdate', {
                        offerId: data.offerId,
                        status: 'negotiating'
                    });
                } else {
                    throw new Error('One or both users not found');
                }
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to accept trade:', error);
                if ((error as Error).message !== 'Trade offer not found') {
                    socket.emit('serverAlert', { message: 'Failed to accept trade: ' + (error as Error).message, type: 'error' });
                }
            } finally {
                client.release();
            }
        });

        // Update the rejectTrade handler
        socket.on('rejectTrade', async (data: { offerId: string; rejectedBy: string; rejectedByAddress: string }) => {
            // Add rate limit check
            if (isTradeActionRateLimited(data.rejectedByAddress.toLowerCase())) {
                socket.emit('serverAlert', { message: 'Please wait before performing more trade actions', type: 'warning' });
                return;
            }
            
            const client = await wsPool.connect();
            console.log('❌ Trade rejection received:', data);
            
            try {
                await client.query('BEGIN');

                // --- Fetch negotiation state from DB ---
                const negotiationRes = await client.query(
                    `SELECT seller_address, buyer_address, status 
                     FROM trade_negotiations 
                     WHERE trade_id = $1 FOR UPDATE`,
                    [data.offerId]
                );

                if (negotiationRes.rows.length === 0) {
                    // Negotiation might already be completed or cancelled, which is okay
                    console.log(`Trade negotiation ${data.offerId} not found or already resolved. No action needed.`);
                    await client.query('COMMIT'); // Commit to release lock if row was found but already done
                    return; 
                }
                const negotiationState = negotiationRes.rows[0];
                // --- End Fetch ---

                // Check if already cancelled/completed
                if (negotiationState.status === 'cancelled' || negotiationState.status === 'completed') {
                    console.log(`Trade ${data.offerId} is already ${negotiationState.status}. No action needed.`);
                    await client.query('COMMIT');
                    return;
                }

                // Determine partner address from DB state
                const partnerAddress = negotiationState.seller_address.toLowerCase() === data.rejectedByAddress.toLowerCase()
                    ? negotiationState.buyer_address.toLowerCase()
                    : negotiationState.seller_address.toLowerCase();
                    
                    // Find the other party's socket
                    const partner = users.find(u => u.walletAddress.toLowerCase() === partnerAddress);
                    
                    if (partner) {
                        // Notify the other party
                        io.to(partner.socketId).emit('tradeNegotiationCancelled', {
                            offerId: data.offerId,
                            reason: `${data.rejectedBy} left the trade`
                        });
                    }
                    
                // Update trade status in database (both tables)
                    await client.query(
                    `UPDATE trade_negotiations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE trade_id = $1`,
                    [data.offerId]
                );
                await updateTradeStatus(client, data.offerId, 'cancelled'); // Update history table
                
                // Reset the offer status back to pending in activeOffers if it exists
                // This allows someone else to potentially accept it
                const offerIndex = activeOffers.findIndex(o => o.id === data.offerId);
                if (offerIndex !== -1) {
                    activeOffers[offerIndex].status = 'pending';
                        // Broadcast offer status update to all clients
                        io.emit('offerStatusUpdate', {
                            offerId: data.offerId,
                            status: 'pending'
                        });
                } else {
                    // If offer is not in activeOffers (e.g., completed/cancelled before rejection), that's fine.
                    console.log(`Offer ${data.offerId} not found in activeOffers during rejection, likely already resolved.`);
                }
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to process trade rejection:', error);
                socket.emit('serverAlert', { message: 'Failed to process trade rejection', type: 'error' });
            } finally {
                client.release();
            }
        });

        // Update the acceptTrade (completion) handler
        socket.on('acceptTrade', async (data: { offerId: string; acceptedBy: string; acceptedByAddress: string }) => {
            // Add rate limit check
            if (isTradeActionRateLimited(data.acceptedByAddress.toLowerCase())) {
                socket.emit('serverAlert', { message: 'Please wait before performing more trade actions', type: 'warning' });
                return;
            }
            
            const client = await wsPool.connect();
            console.log('🤝 Processing trade acceptance:', data);
            
            try {
                await client.query('BEGIN');
                
                // --- CHANGE: Use database query instead of in-memory state ---
                const negotiationRes = await client.query(
                    `SELECT seller_address, buyer_address, status, seller_locked, buyer_locked, seller_items, buyer_items 
                     FROM trade_negotiations 
                     WHERE trade_id = $1 FOR UPDATE`,
                    [data.offerId]
                );

                if (negotiationRes.rows.length === 0) {
                    throw new Error('Trade negotiation not found in database.');
                }
                const negotiationState = negotiationRes.rows[0];
                // --- END CHANGE ---

                // Ensure the trade was actually locked by the buyer
                if (!negotiationState.buyer_locked) { // Use DB column name
                     throw new Error('Cannot complete trade: Buyer items were not locked.');
                }
                
                // Log the state being used for completion
                console.log('🤝 acceptTrade: Completing trade using state read from DB:', {
                    trade_id: data.offerId, // Add trade_id for clarity
                    buyerItems: negotiationState.buyer_items,    
                    sellerItems: negotiationState.seller_items,   
                    buyerAddress: negotiationState.buyer_address,
                    sellerAddress: negotiationState.seller_address
                });

                // Record final trade items using negotiationState data
                await recordTradeItems(client, data.offerId, negotiationState.buyer_items, negotiationState.buyer_address, negotiationState.seller_address);
                await recordTradeItems(client, data.offerId, negotiationState.seller_items, negotiationState.seller_address, negotiationState.buyer_address);
                    
                    // Process buyer's items (items buyer is giving to seller)
                for (const item of negotiationState.buyer_items) { // Use DB data
                    // --- Corrected Base Item ID Extraction ---
                    let baseItemId = item.id.replace(/^(locked-|your-|partner-|original-)*/g, ''); 
                    baseItemId = baseItemId.split('-')[0]; 
                    // --- End Correction ---
                        console.log('Processing buyer item:', baseItemId);
                        
                        // Remove from buyer's inventory
                        await client.query(
                            `UPDATE player_inventories 
                             SET quantity = quantity - 1
                             WHERE wallet_address = $1 AND item_id = $2`,
                        [negotiationState.buyer_address.toLowerCase(), baseItemId] // Use DB address
                        );
                        
                        // Add to seller's inventory
                        await client.query(
                            `INSERT INTO player_inventories (wallet_address, item_id, quantity)
                             VALUES ($1, $2, 1)
                             ON CONFLICT (wallet_address, item_id) 
                             DO UPDATE SET quantity = player_inventories.quantity + 1`,
                        [negotiationState.seller_address.toLowerCase(), baseItemId] // Use DB address
                        );
                    }
                    
                    // Process seller's items (items seller is giving to buyer)
                for (const item of negotiationState.seller_items) { // Use DB data
                    // --- Corrected Base Item ID Extraction ---
                    let baseItemId = item.id.replace(/^(locked-|your-|partner-|original-)*/g, ''); 
                    baseItemId = baseItemId.split('-')[0]; 
                    // --- End Correction ---
                        console.log('Processing seller item:', baseItemId);
                        
                        // Remove from seller's inventory
                        await client.query(
                            `UPDATE player_inventories 
                             SET quantity = quantity - 1
                             WHERE wallet_address = $1 AND item_id = $2`,
                        [negotiationState.seller_address.toLowerCase(), baseItemId] // Use DB address
                        );
                        
                        // Add to buyer's inventory
                        await client.query(
                            `INSERT INTO player_inventories (wallet_address, item_id, quantity)
                             VALUES ($1, $2, 1)
                             ON CONFLICT (wallet_address, item_id) 
                             DO UPDATE SET quantity = player_inventories.quantity + 1`,
                        [negotiationState.buyer_address.toLowerCase(), baseItemId] // Use DB address
                        );
                    }
                    
                // Update trade status in history table
                    await updateTradeStatus(client, data.offerId, 'completed');

                // Update negotiation table status (optional, but good practice)
                await client.query(
                    `UPDATE trade_negotiations SET status = 'completed' WHERE trade_id = $1`,
                    [data.offerId]
                );
                    
                    // Get updated inventories for both parties
                    const buyerInventory = await client.query(
                        `SELECT item_id, quantity FROM player_inventories WHERE wallet_address = $1`,
                    [negotiationState.buyer_address.toLowerCase()] // Use DB address
                    );
                    
                    const sellerInventory = await client.query(
                        `SELECT item_id, quantity FROM player_inventories WHERE wallet_address = $1`,
                    [negotiationState.seller_address.toLowerCase()] // Use DB address
                    );

                    console.log('Updated inventories:', {
                        buyer: buyerInventory.rows,
                        seller: sellerInventory.rows
                    });
                    
                    // Find the buyer and seller sockets
                const buyer = users.find(u => u.walletAddress.toLowerCase() === negotiationState.buyer_address.toLowerCase()); // Use DB address
                const seller = users.find(u => u.walletAddress.toLowerCase() === negotiationState.seller_address.toLowerCase()); // Use DB address
                    
                    if (buyer && seller) {
                    // Emit completion events with correct received/given items based on negotiationState
                        io.to(buyer.socketId).emit('tradeCompleted', {
                            offerId: data.offerId,
                        receivedItems: negotiationState.seller_items, // Buyer receives seller's items
                        givenItems: negotiationState.buyer_items,     // Buyer gives their items
                            newInventory: Object.fromEntries(buyerInventory.rows.map(row => [row.item_id, row.quantity]))
                        });
                        
                        io.to(seller.socketId).emit('tradeCompleted', {
                            offerId: data.offerId,
                        receivedItems: negotiationState.buyer_items, // Seller receives buyer's items
                        givenItems: negotiationState.seller_items,    // Seller gives their original item(s)
                            newInventory: Object.fromEntries(sellerInventory.rows.map(row => [row.item_id, row.quantity]))
                        });
                    }
                    
                // Remove the offer from activeOffers 
                    activeOffers = activeOffers.filter(o => o.id !== data.offerId);
                    io.emit('offerRemoved', data.offerId);
                
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Failed to complete trade:', error);
                // *** MODIFIED: Use serverAlert for trade failure ***
                // Emit to the user who tried to accept
                const userSocket = users.find(u => u.walletAddress.toLowerCase() === data.acceptedByAddress.toLowerCase())?.socketId;
                if (userSocket) {
                    io.to(userSocket).emit('serverAlert', { 
                        message: 'Trade failed: ' + (error as Error).message,
                        type: 'error' 
                    });
                }
                // Keep the generic tradeFailed event for potential internal handling
                socket.emit('tradeFailed', {
                    offerId: data.offerId,
                    error: 'Failed to complete trade: ' + (error as Error).message
                });
            } finally {
                client.release();
            }
        });

        // Update disconnect handler to clean up negotiations
        socket.on('disconnect', async () => {
            const user = users.find(u => u.socketId === socket.id);
            if (user) {
                console.log(`${user.username} disconnected`);
                const disconnectedAddress = user.walletAddress.toLowerCase();

                // Remove user from users array
                users = users.filter(u => u.socketId !== socket.id);
                
                // Cancel any PENDING offers from this user (offers not yet accepted)
                const offersToCancel = activeOffers.filter(offer => 
                    offer.offerer.toLowerCase() === disconnectedAddress && offer.status === 'pending'
                );
                offersToCancel.forEach(offer => {
                    console.log(`🔴 Cancelling pending offer ${offer.id} from disconnected user ${user.username}`);
                    activeOffers = activeOffers.filter(o => o.id !== offer.id);
                    io.emit('tradeOfferCancelled', offer.id);
                    // Update DB status for pending offers in trade_history
                    // Use a separate async function or pool connection to avoid blocking disconnect
                    cancelTradeHistoryOffer(offer.id).catch(console.error);
                });
                
                // Find and Cancel active NEGOTIATIONS involving this user 
                cancelActiveNegotiationsForUser(disconnectedAddress, io).catch(console.error);
                
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

// --- Helper Functions for Disconnect Logic ---

async function cancelTradeHistoryOffer(tradeId: string) {
    const client = await wsPool.connect();
    try {
        await client.query(`UPDATE trade_history SET status = 'cancelled' WHERE trade_id = $1 AND status = 'pending'`, [tradeId]);
        console.log(`Cancelled trade_history entry for pending offer ${tradeId}`);
    } catch (error) {        console.error(`Error cancelling trade_history for offer ${tradeId}:`, error);
    } finally {
        if (client) client.release();
    }
}

async function cancelActiveNegotiationsForUser(disconnectedAddress: string, io: SocketServer) {
    const client = await wsPool.connect();
    let userNegotiations: { trade_id: string, seller_address: string, buyer_address: string }[] = [];
    try {
        // Find negotiations in 'waiting' status involving the disconnected user
        const negotiationRes = await client.query(
            `SELECT trade_id, seller_address, buyer_address 
             FROM trade_negotiations 
             WHERE (seller_address = $1 OR buyer_address = $1) AND status = 'waiting'`,
            [disconnectedAddress]
        );
        userNegotiations = negotiationRes.rows;

        if (userNegotiations.length > 0) {
            await client.query('BEGIN');
            
            for (const negotiation of userNegotiations) {
                const partnerAddress = negotiation.buyer_address.toLowerCase() === disconnectedAddress 
                    ? negotiation.seller_address.toLowerCase() 
                    : negotiation.buyer_address.toLowerCase();
                
                // Update trade status in both tables to cancelled
                console.log(`🔴 Cancelling negotiation ${negotiation.trade_id} due to disconnect.`);
                await client.query(
                    `UPDATE trade_negotiations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE trade_id = $1`,
                    [negotiation.trade_id]
                );
                await updateTradeStatus(client, negotiation.trade_id, 'cancelled'); // Update history

                // Notify the partner if they are still online
                const partner = users.find(u => u.walletAddress.toLowerCase() === partnerAddress);
                if (partner) {
                    console.log(`🔴 Notifying partner ${partner.username} about cancelled negotiation ${negotiation.trade_id}`);
                    io.to(partner.socketId).emit('tradeNegotiationCancelled', {
                        offerId: negotiation.trade_id,
                        reason: 'Partner disconnected'
                    });
                }
                
                // Reset the original offer in activeOffers back to 'pending' if it exists
                const offerIndex = activeOffers.findIndex(o => o.id === negotiation.trade_id);
                if (offerIndex !== -1) {
                    activeOffers[offerIndex].status = 'pending';
                    io.emit('offerStatusUpdate', { offerId: negotiation.trade_id, status: 'pending' });
                }
            }
            
            await client.query('COMMIT');
        }
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error cancelling active negotiations on disconnect:', error);
    } finally {
       if (client) client.release();
    }
}
// --- End Helper Functions --- 