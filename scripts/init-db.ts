import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables from .env file
dotenv.config();

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not defined in environment variables');
    process.exit(1);
}

// Create a new pool specifically for initialization
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    console.log('Attempting to connect to database...');
    console.log('Using database URL:', process.env.DATABASE_URL);
    
    const client = await pool.connect();
    console.log('Connected to database successfully');
    
    try {
        await client.query('BEGIN');
        console.log('Starting table creation...');

        // Create users table
        console.log('Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                wallet_address VARCHAR(42) PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_banned BOOLEAN DEFAULT FALSE,
                ban_reason TEXT,
                role VARCHAR(20) DEFAULT 'user',
                nonce VARCHAR(100),
                UNIQUE (username),
                UNIQUE (email)
            );
        `);
        console.log('Users table created successfully');

        // Create player_profiles table
        console.log('Creating player_profiles table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS player_profiles (
                profile_id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
                level INTEGER DEFAULT 1,
                coins INTEGER DEFAULT 0,
                xp INTEGER DEFAULT 0,
                xp_to_next_level INTEGER DEFAULT 150,
                prestige INTEGER DEFAULT 0,
                status VARCHAR(100) DEFAULT 'Newbie',
                joined BOOLEAN DEFAULT TRUE,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (wallet_address)
            );
        `);
        console.log('Player profiles table created successfully');

        await client.query('COMMIT');
        console.log('Database initialized successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end(); // Close all connections
    }
}

// Run the initialization
initializeDatabase()
    .then(() => {
        console.log('Database setup completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    });