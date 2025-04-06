import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

interface InventoryItem {
    id: string;
    name: string;
    description: string;
    category: string;
    subCategory: string;
    rarity: string;
    imageUrl: string;
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

    // Convert wallet address to lowercase for consistency
    const normalizedWalletAddress = walletAddress.toLowerCase();

    try {
        // Get inventory items with their details
        const result = await pool.query<InventoryItem>(`
            SELECT 
                i.id,
                i.name,
                i.description,
                i.category,
                i.sub_category as "subCategory",
                i.rarity,
                i.image_url as "imageUrl",
                i.color,
                pi.quantity,
                pi.equipped
            FROM player_inventories pi
            JOIN items i ON pi.item_id = i.id
            WHERE pi.wallet_address = $1
        `, [normalizedWalletAddress]);

        // Return the items
        res.status(200).json({
            items: result.rows
        });
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        res.status(500).json({ 
            error: 'Failed to fetch inventory items',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 