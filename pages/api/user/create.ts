import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { pool } from '../../../lib/db';
import { withTransaction, handleDatabaseError } from '../../../utils/db';
import { DATABASE_TABLES, GAME_CONSTANTS } from '../../../constants/game';
import { validateUsername } from '../../../utils/validation';

// Function to fetch user data (joins users and player_profiles)
const fetchUserData = async (client: PoolClient, walletAddress: string) => {
    const userResult = await client.query(
        `SELECT u.username, p.level, p.coins, p.xp, p.xp_to_next_level, p.prestige, p.status
         FROM ${DATABASE_TABLES.USERS} u
         LEFT JOIN ${DATABASE_TABLES.PLAYER_PROFILES} p ON u.wallet_address = p.wallet_address
         WHERE u.wallet_address = $1`,
        [walletAddress]
    );
    if (userResult.rows.length === 0) {
        // This case should be rare if INSERT ON CONFLICT worked, but good to handle
        throw new Error('User not found after upsert attempt.');
    }
    // If profile doesn't exist yet (possible race condition?), return user with null/default profile
    const user = userResult.rows[0];
    return {
        username: user.username,
        walletAddress: walletAddress,
        level: user.level ?? 1,
        coins: user.coins ?? 0,
        xp: user.xp ?? 0,
        xp_to_next_level: user.xp_to_next_level ?? GAME_CONSTANTS.DEFAULT_XP_TO_NEXT_LEVEL,
        prestige: user.prestige ?? 0,
        status: user.status ?? 'Newbie'
    };
};

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

        const normalizedWalletAddress = walletAddress.toLowerCase();
        let userData;
        let userJustCreated = false; // Track if the user row itself was new

        userData = await withTransaction(pool, async (client) => {
            // Upsert user: Insert or update username if wallet exists
            const userUpsertResult = await client.query(
                `INSERT INTO ${DATABASE_TABLES.USERS} (wallet_address, username)
                 VALUES ($1, $2)
                 ON CONFLICT (wallet_address) DO UPDATE SET username = EXCLUDED.username
                 RETURNING xmax`, // xmax=0 for INSERT, >0 for UPDATE
                [normalizedWalletAddress, username]
            );
            
            // Check if a row was inserted (xmax=0) or updated (xmax>0)
            // userUpsertResult.rows[0]?.xmax === '0' indicates an INSERT occurred.
            // If rows is empty or xmax > 0, it was an update or no-op.
            if (userUpsertResult.rows.length > 0 && userUpsertResult.rows[0].xmax === '0') {
                userJustCreated = true;
            } 

            // Upsert profile (create if not exists with default values)
            await client.query(
                `INSERT INTO ${DATABASE_TABLES.PLAYER_PROFILES} (
                    wallet_address, level, coins, xp, xp_to_next_level, prestige, status
                 ) VALUES ($1, 1, 0, 0, $2, 0, 'Newbie')
                 ON CONFLICT (wallet_address) DO NOTHING`,
                [normalizedWalletAddress, GAME_CONSTANTS.DEFAULT_XP_TO_NEXT_LEVEL]
            );

            // Fetch the final state of the user data
            return await fetchUserData(client, normalizedWalletAddress);
        });

        // Status code depends on whether the *user* record was newly created
        const statusCode = userJustCreated ? 201 : 200;
        const message = userJustCreated ? 'User created successfully' : 'Username updated or user profile confirmed/created';

        res.status(statusCode).json({ message, user: userData });

    } catch (error) {
        // Call error handler with only the error object
        handleDatabaseError(error);
        // If handleDatabaseError doesn't send a response, we might need to send one here
        // For now, assume it handles the response or re-throws
        if (!res.headersSent) {
             console.error('Error handler did not send response, sending generic 500');
             res.status(500).json({ error: 'An unexpected server error occurred.' });
        }
    }
} 