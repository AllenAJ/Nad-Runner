import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT 
                cm.id,
                cm.sender_address,
                u.username as sender_name,
                cm.message,
                cm.created_at
            FROM chat_messages cm
            JOIN users u ON cm.sender_address = u.wallet_address
            ORDER BY cm.created_at DESC
            LIMIT 50
        `);
        client.release();

        res.status(200).json(result.rows.reverse());
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
} 