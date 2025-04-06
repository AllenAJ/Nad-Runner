import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

interface InventoryItem {
    id: string;
    name: string;
    description: string;
    category: string;
    sub_category: string;
    rarity: string;
    price: number;
    image_url: string;
    color: string | null;
    quantity: number;
    equipped: boolean;
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

    try {
        // Convert wallet address to lowercase for consistency
        const normalizedAddress = walletAddress.toLowerCase();

        // First, ensure the user exists
        const userExists = await pool.query(
            'SELECT wallet_address FROM users WHERE wallet_address = $1',
            [normalizedAddress]
        );

        if (userExists.rows.length === 0) {
            // Create user and profile if they don't exist
            await pool.query(`
                WITH new_user AS (
                    INSERT INTO users (wallet_address, username)
                    VALUES ($1, $2)
                    ON CONFLICT (wallet_address) DO UPDATE
                    SET last_login = CURRENT_TIMESTAMP
                    RETURNING wallet_address
                )
                INSERT INTO player_profiles (wallet_address)
                SELECT wallet_address FROM new_user
                ON CONFLICT (wallet_address) DO UPDATE
                SET last_updated = CURRENT_TIMESTAMP
            `, [normalizedAddress, `Player_${normalizedAddress.slice(0, 6)}`]);
        }

        // Get inventory items with their details
        const result = await pool.query<InventoryItem>(`
            SELECT 
                i.*,
                pi.quantity,
                pi.equipped
            FROM player_inventories pi
            JOIN items i ON pi.item_id = i.id
            WHERE pi.wallet_address = $1
        `, [normalizedAddress]);

        // Get loadouts
        const loadoutResult = await pool.query(`
            SELECT *
            FROM outfit_loadouts
            WHERE wallet_address = $1
            ORDER BY created_at DESC
        `, [normalizedAddress]);

        // Transform the data to match frontend format
        const transformedItems = result.rows.map(item => ({
            id: item.id,
            key: item.id,
            name: item.name,
            description: item.description,
            category: item.category,
            subCategory: item.sub_category,
            sub_category: item.sub_category, // Keep for compatibility
            rarity: item.rarity,
            imageUrl: item.image_url,
            image_url: item.image_url, // Keep for compatibility
            price: item.price,
            color: item.color,
            quantity: item.quantity,
            equipped: item.equipped
        }));

        res.status(200).json({
            items: transformedItems,
            loadouts: loadoutResult.rows
        });
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        res.status(500).json({ 
            error: 'Failed to fetch inventory items',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 