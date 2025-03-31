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
                high_score INTEGER DEFAULT 0,
                box_jumps INTEGER DEFAULT 0,
                high_score_box_jumps INTEGER DEFAULT 0,
                rounds INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (wallet_address)
            );
        `);

        // Add new columns if they don't exist
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'high_score_box_jumps'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN high_score_box_jumps INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'box_jumps'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN box_jumps INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'high_score'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN high_score INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'player_profiles' AND column_name = 'rounds'
                ) THEN 
                    ALTER TABLE player_profiles ADD COLUMN rounds INTEGER DEFAULT 0;
                END IF;
            END $$;
        `);
        console.log('Player profiles table created successfully');

        // Create chat_messages table
        console.log('Creating chat_messages table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                sender_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Chat messages table created successfully');

        // Create archive table
        console.log('Creating chat_messages_archive table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages_archive (
                id SERIAL,
                sender_address VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id, created_at)
            ) PARTITION BY RANGE (created_at);
        `);

        // Create initial partition for current month
        const currentDate = new Date();
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        const partitionName = `chat_messages_archive_y${currentDate.getFullYear()}m${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

        await client.query(`
            CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF chat_messages_archive
            FOR VALUES FROM ('${currentDate.toISOString()}') TO ('${nextMonth.toISOString()}');
        `);

        // Add indexes for better query performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at 
            ON chat_messages(created_at);
        `);

        // Function to create new partitions automatically
        await client.query(`
            CREATE OR REPLACE FUNCTION create_partition_and_insert()
            RETURNS trigger AS
            $$
            DECLARE
                partition_date TEXT;
                partition_name TEXT;
                start_date TIMESTAMP;
                end_date TIMESTAMP;
            BEGIN
                start_date := date_trunc('month', NEW.created_at);
                end_date := start_date + interval '1 month';
                partition_date := to_char(NEW.created_at, 'YYYY_MM');
                partition_name := 'chat_messages_archive_y' || partition_date;
                
                IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
                    EXECUTE format(
                        'CREATE TABLE IF NOT EXISTS %I PARTITION OF chat_messages_archive
                         FOR VALUES FROM (%L) TO (%L)',
                        partition_name,
                        start_date,
                        end_date
                    );
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger for automatic partition creation
        await client.query(`
            DROP TRIGGER IF EXISTS create_partition_trigger ON chat_messages_archive;
            CREATE TRIGGER create_partition_trigger
                BEFORE INSERT ON chat_messages_archive
                FOR EACH ROW
                EXECUTE FUNCTION create_partition_and_insert();
        `);

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