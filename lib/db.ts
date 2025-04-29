import { Pool } from 'pg';
import { Achievement } from '../constants/achievements'; // Import Achievement type
import { checkAchievements } from './achievements'; // Import achievement checking function

// Configure the database connection
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Neon database connection
    }
});

// Initialize all database tables
export async function initializeDatabase() {
    try {
        await createScoresTable();
        await createPlayerProfilesTable();
        await normalizeWalletAddresses();
        console.log('All database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        throw error;
    }
}

// Modify the existing connection test to also initialize tables
pool.connect(async (err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
    } else {
        console.log('Successfully connected to database');
        try {
            await initializeDatabase();
        } catch (error) {
            console.error('Error during database initialization:', error);
        }
        release();
    }
});

export async function createScoresTable() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                wallet_address VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Scores table created successfully');
    } catch (error) {
        console.error('Error creating scores table:', error);
        throw error;
    } finally {
        client.release();
    }
}

export async function saveScore(name: string, score: number, walletAddress?: string) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `INSERT INTO scores (name, score, wallet_address)
             VALUES ($1, $2, $3)
             RETURNING *;`,
            [name, score, walletAddress?.toLowerCase()]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error saving score:', error);
        throw error;
    } finally {
        client.release();
    }
}

export async function getTopScores(limit = 100) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT name, score, wallet_address, created_at
             FROM scores
             ORDER BY score DESC
             LIMIT $1;`,
            [limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Error getting top scores:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Add highScoreBoxJumps to the user schema
interface User {
  // ... existing fields ...
  highScore: number;
  boxJumps: number;
  highScoreBoxJumps: number;  // New field
  coins: number;
  rounds: number;
  level: number;
}

// Update your user table/collection schema
const userSchema = {
  // ... existing fields ...
  highScoreBoxJumps: {
    type: Number,
    default: 0
  }
};

// Add this function to create/update the player_profiles table
export async function createPlayerProfilesTable() {
    const client = await pool.connect();
    try {
        // First ensure the table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS player_profiles (
                wallet_address VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255)
            );
        `);

        // Add all new columns if they don't exist
        await client.query(`
            DO $$ 
            BEGIN 
                -- Add high_score column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'high_score'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN high_score INTEGER DEFAULT 0;
                END IF;

                -- Add box_jumps column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'box_jumps'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN box_jumps INTEGER DEFAULT 0;
                END IF;

                -- Add high_score_box_jumps column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'high_score_box_jumps'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN high_score_box_jumps INTEGER DEFAULT 0;
                END IF;

                -- Add coins column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'coins'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN coins INTEGER DEFAULT 0;
                END IF;

                -- Add rounds column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'rounds'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN rounds INTEGER DEFAULT 0;
                END IF;

                -- Add level column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'level'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN level INTEGER DEFAULT 1;
                END IF;

                -- Add xp column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'xp'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN xp INTEGER DEFAULT 0;
                END IF;

                -- Add xp_to_next_level column (if not already added)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'xp_to_next_level'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN xp_to_next_level INTEGER DEFAULT 150;
                END IF;

                -- Add achievements_bitmap column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'achievements_bitmap'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN achievements_bitmap BIGINT DEFAULT 0;
                END IF;

                -- Add prestige column (if not already added)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'prestige'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN prestige INTEGER DEFAULT 0;
                END IF;

                -- Add status column
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'status'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN status VARCHAR(255) DEFAULT 'active';
                END IF;

                -- Add timestamp columns
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'created_at'
                ) THEN 
                    ALTER TABLE player_profiles 
                    ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'updated_at'
                ) THEN 
                    ALTER TABLE player_profiles 
                    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);

        console.log('Player profiles table created/updated successfully');
    } catch (error) {
        console.error('Error creating/updating player_profiles table:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Add a function to update player stats (Note: This might be redundant if only updatePlayerGameStats is used)
export async function updatePlayerStats(
    walletAddress: string, 
    score: number, 
    boxJumpsThisRound: number
) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `UPDATE player_profiles 
             SET high_score = GREATEST(high_score, $2),
                 box_jumps = box_jumps + $3,
                 high_score_box_jumps = GREATEST(high_score_box_jumps, $3),
                 rounds = rounds + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE wallet_address = LOWER($1)
             RETURNING *;`,
            [walletAddress, score, boxJumpsThisRound]
        );
        // Note: This function doesn't handle achievements or level/XP/coins
        return result.rows[0];
    } catch (error) {
        console.error('Error updating player stats:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Add this new function to fetch player data
export async function getPlayerData(walletAddress: string) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                p.level,
                p.coins,
                p.xp,
                p.xp_to_next_level,
                p.prestige,
                p.status,
                p.high_score,
                p.box_jumps,
                p.high_score_box_jumps,
                p.rounds,
                p.achievements_bitmap, -- Fetch the bitmap
                u.username
            FROM player_profiles p
            JOIN users u ON p.wallet_address = u.wallet_address
            WHERE p.wallet_address = LOWER($1)
        `, [walletAddress]);

        // Return the first row found, or null if not found
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error('Error fetching player data:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Calculate XP required for next level using a progressive scale
function calculateXpToNextLevel(level: number): number {
    // Base XP requirement is 150 (from GAME_CONSTANTS.DEFAULT_XP_TO_NEXT_LEVEL)
    // Each level requires 20% more XP than the previous level
    return Math.floor(150 * Math.pow(1.2, level - 1));
}

// Interface for the return type of updatePlayerGameStats
interface UpdatePlayerGameStatsResult {
    playerStats: any; // Consider defining a more specific type for player stats row
    unlockedAchievements: Achievement[];
}

// Add this function to update player stats after a game
export async function updatePlayerGameStats(
    walletAddress: string,
    score: number, // Assuming score represents distance for now
    boxJumpsThisRound: number,
    coinsCollected: number,
    xpGained: number
): Promise<UpdatePlayerGameStatsResult> { // Add return type annotation
    const client = await pool.connect();
    try {
        // First, get current player stats, or null if profile doesn't exist
        const currentProfile = await getPlayerData(walletAddress);

        // Initialize variables with defaults or from current profile
        let level = 1;
        let xp = 0;
        let xp_to_next_level = calculateXpToNextLevel(1);
        let currentBitmap = 0n; // Use bigint literal
        let totalBoxJumps = 0;
        let totalCoins = 0;
        let totalRounds = 0;
        let currentHighScore = 0;

        if (currentProfile) {
            level = currentProfile.level;
            xp = currentProfile.xp;
            xp_to_next_level = currentProfile.xp_to_next_level;
            currentBitmap = BigInt(currentProfile.achievements_bitmap || 0);
            totalBoxJumps = currentProfile.box_jumps;
            totalCoins = currentProfile.coins;
            totalRounds = currentProfile.rounds;
            currentHighScore = currentProfile.high_score;
        } else {
            console.warn(`Player profile not found for ${walletAddress} during stat update. Using defaults.`);
        }
        
        // --- Calculate updated stats --- 
        const newTotalBoxJumps = totalBoxJumps + boxJumpsThisRound;
        const newTotalCoins = totalCoins + coinsCollected;
        const newTotalRounds = totalRounds + 1; // Increment rounds played
        const newHighScore = Math.max(currentHighScore, score); // Calculate new high score
        xp += xpGained;
        
        // Check for level ups
        while (xp >= xp_to_next_level) {
            xp -= xp_to_next_level;
            level += 1;
            xp_to_next_level = calculateXpToNextLevel(level);
        }

        // --- Achievement Checking --- 
        const achievementResult = checkAchievements(
            currentBitmap,
            { // Updated Overall Stats (using the calculated values)
                level: level,
                xp: xp,
                box_jumps: newTotalBoxJumps, 
                coins: newTotalCoins,
                rounds: newTotalRounds,
                high_score: newHighScore, // Use the calculated new high score
            },
            { // Current Round Stats
                score: score, // distance 
                boxJumps: boxJumpsThisRound,
                coins: coinsCollected
            }
        );
        const newBitmap = achievementResult.newBitmap;
        const unlockedAchievements = achievementResult.unlockedAchievements;
        // --------------------------

        // --- Database Update --- 
        // Use INSERT ... ON CONFLICT UPDATE to handle both new and existing profiles
        const result = await client.query(`
            INSERT INTO player_profiles (
                wallet_address, high_score, box_jumps, high_score_box_jumps, 
                coins, xp, level, xp_to_next_level, achievements_bitmap, rounds, updated_at
            )
            SELECT 
                LOWER($1) as wallet_address,
                GREATEST(COALESCE(p.high_score, 0), $2) as high_score,
                COALESCE(p.box_jumps, 0) + $3 as box_jumps,
                GREATEST(COALESCE(p.high_score_box_jumps, 0), $3) as high_score_box_jumps,
                COALESCE(p.coins, 0) + $4 as coins,
                $5 as xp,
                $6 as level,
                $7 as xp_to_next_level,
                $8::BIGINT as achievements_bitmap, -- Use the newBitmap from achievement check
                COALESCE(p.rounds, 0) + 1 as rounds,
                CURRENT_TIMESTAMP as updated_at
            FROM (SELECT wallet_address FROM users WHERE wallet_address = LOWER($1)) u -- Only need wallet_address here
            LEFT JOIN player_profiles p ON u.wallet_address = p.wallet_address
            WHERE u.wallet_address IS NOT NULL
            ON CONFLICT (wallet_address)
            DO UPDATE SET
                high_score = GREATEST(player_profiles.high_score, EXCLUDED.high_score),
                box_jumps = EXCLUDED.box_jumps,
                high_score_box_jumps = GREATEST(player_profiles.high_score_box_jumps, EXCLUDED.high_score_box_jumps),
                coins = EXCLUDED.coins,
                xp = EXCLUDED.xp,
                level = EXCLUDED.level,
                xp_to_next_level = EXCLUDED.xp_to_next_level,
                achievements_bitmap = EXCLUDED.achievements_bitmap, -- Make sure this uses the new value
                rounds = EXCLUDED.rounds,
                updated_at = EXCLUDED.updated_at
            RETURNING wallet_address; -- Only need to return something to confirm update/insert
        `, [
            walletAddress, 
            score,             // $2: Use round score for high_score check
            boxJumpsThisRound, // $3
            coinsCollected,    // $4
            xp,                // $5
            level,             // $6
            xp_to_next_level,  // $7
            newBitmap.toString() // $8: Pass the potentially updated bitmap
        ]);
        
        // Fetch the complete updated profile data in a separate query (joins with users for username)
        const finalResult = await client.query(`
            SELECT p.*, u.username 
            FROM player_profiles p
            JOIN users u ON p.wallet_address = u.wallet_address
            WHERE p.wallet_address = LOWER($1);
        `, [walletAddress]);

        if (finalResult.rows.length === 0) {
            // This case should be less likely now with INSERT ON CONFLICT
            throw new Error(`Failed to update or retrieve player profile for ${walletAddress}`);
        }

        // Return updated stats and the list of newly unlocked achievements
        return {
            playerStats: finalResult.rows[0],
            unlockedAchievements: unlockedAchievements // Pass the list from checkAchievements
        };
    } catch (error) {
        console.error('Error updating player game stats:', error);
        throw error; // Rethrow the error to be handled by the API layer
    } finally {
        client.release();
    }
}

// Add this function to normalize existing wallet addresses
export async function normalizeWalletAddresses() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update scores table
        await client.query(`
            UPDATE scores 
            SET wallet_address = LOWER(wallet_address) 
            WHERE wallet_address IS NOT NULL;
        `);

        // Update player_profiles table
        await client.query(`
            UPDATE player_profiles 
            SET wallet_address = LOWER(wallet_address);
        `);

        // Update users table
        await client.query(`
            UPDATE users 
            SET wallet_address = LOWER(wallet_address);
        `);

        await client.query('COMMIT');
        console.log('Successfully normalized wallet addresses');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error normalizing wallet addresses:', error);
        throw error;
    } finally {
        client.release();
    }
}