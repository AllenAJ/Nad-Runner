import { Server } from 'socket.io';
import { createServer } from 'http';
import { Pool } from 'pg'; // Import Pool directly
import dotenv from 'dotenv';
import path from 'path';
import { CronJob } from 'cron';
import { CHAT_CONFIG } from '../config/chat';

// Load environment variables first with absolute path
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('WebSocket server DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'Not found');

// Create a dedicated pool for the WebSocket server
const wsPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test the connection
wsPool.connect((err, client, release) => {
    if (err) {
        console.error('WebSocket DB connection error:', err.stack);
    } else {
        console.log('WebSocket server successfully connected to database');
        release();
    }
});

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

interface OnlineUser {
    walletAddress: string;
    username: string;
    socketId: string;
}

const onlineUsers = new Map<string, OnlineUser>();
let clearMessagesTimeout: NodeJS.Timeout | null = null;

// Add rate limiting
const messageRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_MESSAGES_PER_WINDOW = 5;

io.on('connection', (socket) => {
    // Cancel any pending message cleanup when a user connects
    if (clearMessagesTimeout) {
        clearTimeout(clearMessagesTimeout);
        clearMessagesTimeout = null;
    }

    socket.on('join', async ({ walletAddress, username }) => {
        onlineUsers.set(socket.id, { walletAddress, username, socketId: socket.id });
        io.emit('onlineUsers', Array.from(onlineUsers.values()).map(u => u.username));
    });

    socket.on('message', async ({ walletAddress, username, message }) => {
        // Check rate limit
        const now = Date.now();
        const userLastMessage = messageRateLimit.get(walletAddress) || 0;
        
        if (now - userLastMessage < RATE_LIMIT_WINDOW) {
            socket.emit('error', 'Please wait before sending another message');
            return;
        }
        
        messageRateLimit.set(walletAddress, now);

        // Validate message
        if (!message || message.length > 500) {
            socket.emit('error', 'Invalid message');
            return;
        }

        let client;
        try {
            client = await wsPool.connect();
            
            const result = await client.query(
                `INSERT INTO chat_messages (sender_address, message)
                 VALUES ($1, $2)
                 RETURNING id, created_at;`,
                [walletAddress, message]
            );

            const newMessage = {
                id: result.rows[0].id,
                sender_address: walletAddress,
                sender_name: username,
                message,
                created_at: result.rows[0].created_at
            };

            io.emit('message', newMessage);
        } catch (error) {
            console.error('Database error:', error);
            socket.emit('error', 'Failed to save message');
        } finally {
            if (client) {
                client.release();
            }
        }
    });

    socket.on('disconnect', async () => {
        onlineUsers.delete(socket.id);
        const remainingUsers = Array.from(onlineUsers.values());
        io.emit('onlineUsers', remainingUsers.map(u => u.username));

        // If no users left, start cleanup timer
        if (remainingUsers.length === 0) {
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
            }, CHAT_CONFIG.EMPTY_ROOM_CLEANUP_DELAY); // Wait 5 minutes before cleanup
        }
    });
});

// Add message cleanup job - runs daily at midnight
const cleanupJob = new CronJob('0 0 * * *', async () => {
    const client = await wsPool.connect();
    try {
        // Move messages older than 30 days to archive table
        await client.query(`
            WITH moved_rows AS (
                DELETE FROM chat_messages 
                WHERE created_at < NOW() - INTERVAL '30 days'
                RETURNING *
            )
            INSERT INTO chat_messages_archive 
            SELECT * FROM moved_rows;
        `);
        
        console.log('Chat message cleanup completed');
    } catch (error) {
        console.error('Cleanup job failed:', error);
    } finally {
        client.release();
    }
});

cleanupJob.start();

const PORT = process.env.WEBSOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});