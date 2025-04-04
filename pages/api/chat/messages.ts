import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let client;
    try {
        client = await pool.connect();

        // Get messages with user information
        const result = await client.query(`
            SELECT 
                cm.id,
                cm.message,
                cm.created_at,
                cm.sender_address,
                u.username as sender_name
            FROM chat_messages cm
            JOIN users u ON cm.sender_address = u.wallet_address
            ORDER BY cm.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        // Get total count for pagination
        const countResult = await client.query('SELECT COUNT(*) FROM chat_messages');
        const totalMessages = parseInt(countResult.rows[0].count);

        res.status(200).json({
            messages: result.rows.reverse(), // Reverse to show oldest first
            totalMessages,
            hasMore: offset + limit < totalMessages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    } finally {
        if (client) client.release();
    }
} 