import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Verbose connection logging
console.log('Database URL:', process.env.DATABASE_URL);

// Configure the database connection with detailed logging
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false  // Important for Neon's SSL requirement
    },
    // Add connection timeout and logging
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
});

// Add error logging to the pool
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

export async function testConnection() {
    const client = await pool.connect();
    try {
        console.log('Database connection successful!');
        const result = await client.query('SELECT NOW()');
        console.log('Current database time:', result.rows[0].now);
    } catch (error) {
        console.error('Connection test failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

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