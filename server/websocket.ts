import { Server } from 'socket.io';
import { createServer } from 'http';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { CronJob } from 'cron';
import { CHAT_CONFIG } from '../config/chat';
import express from 'express';
import https from 'https';
import http from 'http';
import { setupSocket } from './socket';

// Load environment variables first with absolute path
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('WebSocket server starting...');

// Create Express app
const app = express();

// Create HTTP server with Express
const httpServer = createServer(app);

// Create a dedicated pool for the WebSocket server
export const wsPool = new Pool({
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

// Self-ping function to keep the server awake
const pingServer = () => {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
    console.log('Pinging server:', serverUrl);
    
    const requester = serverUrl.startsWith('https') ? https : require('http');
    
    requester.get(`${serverUrl}/health`, (res: http.IncomingMessage) => {
        if (res.statusCode === 200) {
            console.log('Server pinged successfully');
        } else {
            console.error('Server ping failed with status:', res.statusCode);
        }
    }).on('error', (err: Error) => {
        console.error('Error pinging server:', err);
    });
};

// Set up periodic ping every 14 minutes
const pingJob = new CronJob('*/14 * * * *', pingServer);
pingJob.start();

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const client = await wsPool.connect();
        await client.query('SELECT 1');
        client.release();

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected',
            lastPing: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Database connection failed',
            uptime: process.uptime()
        });
    }
});

const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:3000", "https://monad-run.vercel.app"],
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["my-custom-header"]
    },
    allowEIO3: true,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
});

// Set up socket event handlers
setupSocket(io);

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

const PORT = process.env.PORT || 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`WebSocket server running on port ${PORT}`);
});