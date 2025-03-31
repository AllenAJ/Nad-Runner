import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { start, end } = req.query;
    
    try {
        const result = await pool.query(
            `SELECT * FROM chat_messages_archive 
             WHERE created_at BETWEEN $1 AND $2 
             ORDER BY created_at DESC 
             LIMIT 1000`,
            [start, end]
        );
        
        res.json({ messages: result.rows });
    } catch (error) {
        console.error('Error fetching archived messages:', error);
        res.status(500).json({ error: 'Failed to fetch archived messages' });
    }
} 