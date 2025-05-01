// pages/api/shop/buy-normal.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Define rarities that can be bought with coins
const NORMAL_RARITIES = ['normal', 'rare'];

interface RequestBody {
    walletAddress?: string;
    itemId?: string;
}

interface ErrorResponse {
    error: string;
    details?: string;
}

interface SuccessResponse {
    message: string;
    itemId: string;
    newCoinBalance: number;
    success: boolean;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { walletAddress, itemId }: RequestBody = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'Wallet address is required' });
    }
    if (!itemId || typeof itemId !== 'string') {
        return res.status(400).json({ error: 'Item ID is required' });
    }

    const normalizedWalletAddress = walletAddress.toLowerCase();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get item details (price, rarity) and player coins
        const dataQuery = `
            SELECT 
                i.price, i.rarity, i.name,
                p.coins
            FROM items i
            LEFT JOIN player_profiles p ON p.wallet_address = $1
            WHERE i.id = $2;
        `;
        const dataResult = await client.query(dataQuery, [normalizedWalletAddress, itemId]);

        if (dataResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item not found' });
        }

        const { price, rarity, coins, name } = dataResult.rows[0];

        // Check if player profile exists (coins would be null if not)
        if (coins === null || coins === undefined) {
            await client.query('ROLLBACK');
            // Should ideally not happen if user exists, but good practice to check
             return res.status(404).json({ error: 'Player profile not found. Cannot determine coin balance.' });
        }

        // 2. Verify item is purchasable with coins
        if (!NORMAL_RARITIES.includes(rarity) || price <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Item not purchasable with coins' });
        }

        // 3. Check if player has enough coins
        if (coins < price) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient coins' });
        }

        // 4. Deduct coins
        const newCoinBalance = coins - price;
        const updateCoinsQuery = `
            UPDATE player_profiles SET coins = $1 WHERE wallet_address = $2;
        `;
        await client.query(updateCoinsQuery, [newCoinBalance, normalizedWalletAddress]);

        // 5. Add item to inventory
        // Using ON CONFLICT to add to quantity if already owned
        const addItemQuery = `
            INSERT INTO player_inventories (wallet_address, item_id, quantity, equipped)
            VALUES ($1, $2, 1, false)
            ON CONFLICT (wallet_address, item_id) DO UPDATE SET quantity = player_inventories.quantity + 1;
        `;
        await client.query(addItemQuery, [normalizedWalletAddress, itemId]);

        await client.query('COMMIT');

        res.status(200).json({
            message: `Purchase successful: ${name}`,
            itemId: itemId,
            newCoinBalance: newCoinBalance,
            success: true
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error purchasing normal item:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error during purchase'
        });
    } finally {
        client.release();
    }
} 