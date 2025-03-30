import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/db';
import { withTransaction, handleDatabaseError } from '../../../utils/db';
import { DATABASE_TABLES, GAME_CONSTANTS } from '../../../constants/game';
import { validateUsername } from '../../../utils/validation';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress, username } = req.body;

    try {
        // Validate inputs
        if (!walletAddress || !username) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const validationError = validateUsername(username);
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const result = await withTransaction(pool, async (client) => {
            // Create user
            await client.query(
                `INSERT INTO ${DATABASE_TABLES.USERS} (wallet_address, username) 
                 VALUES ($1, $2)`,
                [walletAddress, username]
            );

            // Create profile
            await client.query(
                `INSERT INTO ${DATABASE_TABLES.PLAYER_PROFILES} (
                    wallet_address,
                    level,
                    coins,
                    xp,
                    xp_to_next_level,
                    prestige,
                    status
                ) VALUES ($1, 1, 0, 0, $2, 0, 'Newbie')`,
                [walletAddress, GAME_CONSTANTS.DEFAULT_XP_TO_NEXT_LEVEL]
            );

            return {
                username,
                walletAddress,
                level: 1,
                coins: 0,
                xp: 0,
                xp_to_next_level: GAME_CONSTANTS.DEFAULT_XP_TO_NEXT_LEVEL,
                prestige: 0,
                status: 'Newbie'
            };
        });

        res.status(200).json({ 
            message: 'User created successfully',
            user: result
        });
    } catch (error) {
        handleDatabaseError(error);
    }
} 