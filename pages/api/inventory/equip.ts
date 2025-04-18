import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress, itemId, equipped, categoryType } = req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!itemId && equipped !== undefined) {
        return res.status(400).json({ error: 'Item ID is required when equipping/unequipping' });
    }

    try {
        // Convert wallet address to lowercase for consistency
        const normalizedAddress = walletAddress.toLowerCase();
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // First check if user exists
            const userExists = await client.query(
                'SELECT wallet_address FROM users WHERE wallet_address = $1',
                [normalizedAddress]
            );

            if (userExists.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // If category type is provided, unequip any previously equipped item in that category
            if (categoryType) {
                console.log(`Unequipping all ${categoryType} items for ${normalizedAddress}`);
                
                // Get all items of this category that are currently equipped
                const equippedItems = await client.query(
                    `SELECT pi.item_id 
                     FROM player_inventories pi
                     JOIN items i ON pi.item_id = i.id
                     WHERE pi.wallet_address = $1 
                     AND i.sub_category = $2
                     AND pi.equipped = true`,
                    [normalizedAddress, categoryType]
                );
                
                // Unequip all items of this category
                if (equippedItems.rows.length > 0) {
                    await client.query(
                        `UPDATE player_inventories
                         SET equipped = false
                         WHERE wallet_address = $1
                         AND item_id = ANY($2)`,
                        [normalizedAddress, equippedItems.rows.map(row => row.item_id)]
                    );
                }
            }
            
            // Update the specified item's equipped status (if provided)
            if (itemId) {
                // Check if the user actually has this item
                const itemExists = await client.query(
                    'SELECT quantity FROM player_inventories WHERE wallet_address = $1 AND item_id = $2',
                    [normalizedAddress, itemId]
                );
                
                if (itemExists.rows.length === 0 || itemExists.rows[0].quantity <= 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Item not found in user inventory' });
                }
                
                // Update the equipped status
                await client.query(
                    `UPDATE player_inventories
                     SET equipped = $3
                     WHERE wallet_address = $1 AND item_id = $2`,
                    [normalizedAddress, itemId, !!equipped]
                );
            }
            
            await client.query('COMMIT');
            
            res.status(200).json({ success: true });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating equipped status:', error);
        res.status(500).json({ 
            error: 'Failed to update equipped status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
} 