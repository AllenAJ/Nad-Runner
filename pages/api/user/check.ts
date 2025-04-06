import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

// Add this interface at the top of the file
interface PlayerProfile {
    wallet_address: string;
    username: string;
    high_score: number;
    box_jumps: number;
    high_score_box_jumps: number;
    coins: number;
    rounds: number;
    level: number;
    xp: number;
}

interface InventoryStats {
    total_items: number;
    equipped_items: number;
    loadouts: number;
}

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
        // Get user and profile data
        const result = await pool.query<PlayerProfile>(
            `SELECT u.username, p.* 
             FROM users u 
             JOIN player_profiles p ON u.wallet_address = p.wallet_address 
             WHERE u.wallet_address = $1`,
            [walletAddress]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Get inventory stats
        const inventoryStats = await pool.query<InventoryStats>(`
            SELECT 
                COUNT(DISTINCT pi.item_id) as total_items,
                COUNT(DISTINCT CASE WHEN pi.equipped THEN pi.item_id END) as equipped_items,
                COUNT(DISTINCT ol.loadout_id) as loadouts
            FROM player_inventories pi
            LEFT JOIN outfit_loadouts ol ON pi.wallet_address = ol.wallet_address
            WHERE pi.wallet_address = $1
        `, [walletAddress]);

        res.status(200).json({
            user: user,
            playerStats: {
                highScore: user.high_score,
                boxJumps: user.box_jumps,
                highScoreBoxJumps: user.high_score_box_jumps,
                coins: user.coins,
                rounds: user.rounds,
                level: user.level
            },
            inventoryStats: inventoryStats.rows[0] || {
                total_items: 0,
                equipped_items: 0,
                loadouts: 0
            }
        });
    } catch (error) {
        console.error('Error checking user:', error);
        res.status(500).json({ 
            error: 'Failed to check user',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 