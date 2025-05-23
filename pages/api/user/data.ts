import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

interface PlayerInventoryItem {
    item_id: string;
    name: string;
    description: string;
    category: string;
    sub_category: string;
    rarity: string;
    image_url: string;
    color: string | null;
    quantity: number;
    equipped: boolean;
}

interface OutfitLoadout {
    loadout_id: number;
    name: string;
    body_item: string | null;
    eyes_item: string | null;
    fur_item: string | null;
    head_item: string | null;
    minipet_item: string | null;
    misc_item: string | null;
    mouth_item: string | null;
    nose_item: string | null;
    skin_item: string | null;
    is_active: boolean;
}

interface PlayerData {
    wallet_address: string;
    username: string;
    high_score: number;
    box_jumps: number;
    high_score_box_jumps: number;
    coins: number;
    rounds: number;
    level: number;
    xp: number;
    xp_to_next_level: number;
    status: string;
    achievements_bitmap: string | bigint | null;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress } = req.query;

    if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Convert wallet address to lowercase for consistency
    const normalizedWalletAddress = walletAddress.toLowerCase();

    try {
        // Get player profile data
        const result = await pool.query<PlayerData>(`
            SELECT 
                p.*,
                u.username
            FROM player_profiles p
            JOIN users u ON p.wallet_address = u.wallet_address
            WHERE p.wallet_address = $1
        `, [normalizedWalletAddress]);

        if (result.rows.length === 0) {
            // If no profile exists, return a 404 status
            return res.status(404).json({
                error: 'User profile not found'
            });
        }

        const playerData = result.rows[0];

        // Get inventory items
        const inventoryResult = await pool.query<PlayerInventoryItem>(`
            SELECT 
                i.*,
                pi.quantity,
                pi.equipped
            FROM player_inventories pi
            JOIN items i ON pi.item_id = i.id
            WHERE pi.wallet_address = $1
        `, [normalizedWalletAddress]);

        // Get loadouts
        const loadoutResult = await pool.query<OutfitLoadout>(`
            SELECT *
            FROM outfit_loadouts
            WHERE wallet_address = $1
            ORDER BY created_at DESC
        `, [normalizedWalletAddress]);

        res.status(200).json({
            playerStats: {
                highScore: playerData.high_score,
                boxJumps: playerData.box_jumps,
                highScoreBoxJumps: playerData.high_score_box_jumps,
                coins: playerData.coins,
                rounds: playerData.rounds,
                level: playerData.level,
                xp: playerData.xp,
                xpToNextLevel: playerData.xp_to_next_level,
                status: playerData.status,
                username: playerData.username,
                achievements_bitmap: playerData.achievements_bitmap ? BigInt(playerData.achievements_bitmap).toString() : '0'
            },
            inventory: {
                items: inventoryResult.rows,
                loadouts: loadoutResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching player data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch player data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 