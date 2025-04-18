import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Allow GET (to retrieve loadouts) and POST (to create/update loadouts)
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress } = req.method === 'GET' ? req.query : req.body;

    if (!walletAddress || typeof walletAddress !== 'string') {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const client = await pool.connect();

    try {
        // GET: Retrieve user's loadouts
        if (req.method === 'GET') {
            const result = await client.query(`
                SELECT *
                FROM outfit_loadouts
                WHERE wallet_address = $1
                ORDER BY created_at DESC
            `, [normalizedAddress]);

            return res.status(200).json({
                loadouts: result.rows
            });
        }
        
        // DELETE: Remove a loadout
        if (req.method === 'DELETE') {
            const { loadoutId } = req.body;
            
            if (!loadoutId) {
                return res.status(400).json({ error: 'Loadout ID is required' });
            }
            
            await client.query('BEGIN');
            
            // If this is the active loadout, make sure to unmark it
            if (req.body.isActive) {
                await client.query(`
                    UPDATE outfit_loadouts
                    SET is_active = false
                    WHERE wallet_address = $1 AND loadout_id = $2
                `, [normalizedAddress, loadoutId]);
            }
            
            // Delete the loadout
            await client.query(`
                DELETE FROM outfit_loadouts
                WHERE wallet_address = $1 AND loadout_id = $2
            `, [normalizedAddress, loadoutId]);
            
            await client.query('COMMIT');
            
            return res.status(200).json({ success: true });
        }
        
        // POST: Create or update a loadout
        if (req.method === 'POST') {
            const { 
                loadoutName, 
                loadoutId,
                bodyItem,
                eyesItem,
                furItem,
                headItem,
                minipetItem,
                miscItem,
                mouthItem,
                noseItem,
                skinItem,
                isActive
            } = req.body;
            
            await client.query('BEGIN');
            
            // If setting as active, unset any current active loadout
            if (isActive) {
                await client.query(`
                    UPDATE outfit_loadouts
                    SET is_active = false
                    WHERE wallet_address = $1 AND is_active = true
                `, [normalizedAddress]);
            }
            
            // If a loadoutId is provided, update the existing loadout
            if (loadoutId) {
                await client.query(`
                    UPDATE outfit_loadouts
                    SET 
                        name = $1,
                        body_item = $2,
                        eyes_item = $3,
                        fur_item = $4,
                        head_item = $5,
                        minipet_item = $6,
                        misc_item = $7,
                        mouth_item = $8,
                        nose_item = $9,
                        skin_item = $10,
                        is_active = $11
                    WHERE wallet_address = $12 AND loadout_id = $13
                `, [
                    loadoutName,
                    bodyItem || null,
                    eyesItem || null,
                    furItem || null,
                    headItem || null,
                    minipetItem || null,
                    miscItem || null,
                    mouthItem || null,
                    noseItem || null,
                    skinItem || null,
                    !!isActive,
                    normalizedAddress,
                    loadoutId
                ]);
                
                await client.query('COMMIT');
                
                return res.status(200).json({ 
                    success: true,
                    loadoutId
                });
            }
            
            // Otherwise, create a new loadout
            if (!loadoutName) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Loadout name is required' });
            }
            
            const result = await client.query(`
                INSERT INTO outfit_loadouts (
                    wallet_address,
                    name,
                    body_item,
                    eyes_item,
                    fur_item,
                    head_item,
                    minipet_item,
                    misc_item,
                    mouth_item,
                    nose_item,
                    skin_item,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING loadout_id
            `, [
                normalizedAddress,
                loadoutName,
                bodyItem || null,
                eyesItem || null,
                furItem || null,
                headItem || null,
                minipetItem || null,
                miscItem || null,
                mouthItem || null,
                noseItem || null,
                skinItem || null,
                !!isActive
            ]);
            
            await client.query('COMMIT');
            
            return res.status(201).json({
                success: true,
                loadoutId: result.rows[0].loadout_id
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error managing outfit loadouts:', error);
        res.status(500).json({ 
            error: 'Failed to manage outfit loadouts',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    } finally {
        client.release();
    }
} 