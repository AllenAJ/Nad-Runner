import { Pool } from 'pg';

// Configure the database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false  // Important for Neon's SSL requirement
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
            [name, score, walletAddress]
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