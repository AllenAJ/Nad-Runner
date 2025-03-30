import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress } = req.query;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        const result = await pool.query(
            `SELECT u.username, p.* 
             FROM users u 
             JOIN player_profiles p ON u.wallet_address = p.wallet_address 
             WHERE u.wallet_address = $1`,
            [walletAddress]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ user: result.rows[0] });
    } catch (error) {
        console.error('Error checking user:', error);
        res.status(500).json({ 
            error: 'Failed to check user',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 