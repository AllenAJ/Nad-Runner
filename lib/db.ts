import { sql } from '@vercel/postgres';

export async function createScoresTable() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                wallet_address VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log('Scores table created successfully');
    } catch (error) {
        console.error('Error creating scores table:', error);
        throw error;
    }
}

export async function saveScore(name: string, score: number, walletAddress?: string) {
    try {
        const result = await sql`
            INSERT INTO scores (name, score, wallet_address)
            VALUES (${name}, ${score}, ${walletAddress})
            RETURNING *;
        `;
        return result.rows[0];
    } catch (error) {
        console.error('Error saving score:', error);
        throw error;
    }
}

export async function getTopScores(limit = 100) {
    try {
        const result = await sql`
            SELECT name, score, wallet_address, created_at
            FROM scores
            ORDER BY score DESC
            LIMIT ${limit};
        `;
        return result.rows;
    } catch (error) {
        console.error('Error getting top scores:', error);
        throw error;
    }
} 