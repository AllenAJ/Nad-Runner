import { Pool } from 'pg';

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

// Add a function to update player stats
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
                u.username
            FROM player_profiles p
            JOIN users u ON p.wallet_address = u.wallet_address
            WHERE p.wallet_address = LOWER($1)
        `, [walletAddress]);

        return result.rows[0];
    } catch (error) {
        console.error('Error fetching player data:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Add this function to update player stats after a game
export async function updatePlayerGameStats(
    walletAddress: string,
    score: number,
    boxJumpsThisRound: number
) {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            WITH updated_stats AS (
                UPDATE player_profiles 
                SET high_score = GREATEST(high_score, $2),
                    box_jumps = box_jumps + $3,
                    high_score_box_jumps = GREATEST(high_score_box_jumps, $3),
                    rounds = rounds + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE wallet_address = LOWER($1)
                RETURNING *
            )
            SELECT 
                p.*,
                u.username
            FROM updated_stats p
            JOIN users u ON p.wallet_address = u.wallet_address;
        `, [walletAddress, score, boxJumpsThisRound]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error updating player stats:', error);
        throw error;
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