import { Pool, PoolClient } from 'pg';
import { DATABASE_TABLES } from '../constants/game';

export class DatabaseError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export async function withTransaction<T>(
    pool: Pool,
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export function handleDatabaseError(error: unknown): never {
    console.error('Database error:', error);
    
    if (error instanceof Error) {
        if (error.message.includes('unique constraint')) {
            if (error.message.includes('username')) {
                throw new DatabaseError('Username already taken', 'UNIQUE_VIOLATION');
            }
            if (error.message.includes('wallet_address')) {
                throw new DatabaseError('Wallet address already registered', 'UNIQUE_VIOLATION');
            }
        }
    }
    
    throw new DatabaseError('An unexpected database error occurred');
} 