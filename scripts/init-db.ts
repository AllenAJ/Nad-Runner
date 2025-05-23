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
                wallet_address VARCHAR(44) PRIMARY KEY,
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
                wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
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
                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS xp_to_next_level INTEGER DEFAULT 150;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS high_score_box_jumps INTEGER DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS box_jumps INTEGER DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS high_score INTEGER DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS rounds INTEGER DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `);
        console.log('Player profiles table created successfully');

        // Create items table
        console.log('Creating items table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS items (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                category VARCHAR(50) NOT NULL,
                sub_category VARCHAR(50) NOT NULL,
                rarity VARCHAR(20) NOT NULL,
                price INTEGER DEFAULT 0,
                image_url TEXT,
                preview_url TEXT,
                color VARCHAR(7),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Items table created successfully');

        // Add preview_url column if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE items ADD COLUMN IF NOT EXISTS preview_url TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `);

        // Create index on items(category) for faster lookups by category
        console.log('Creating index on items(category)...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
        `);
        console.log('Index on items(category) created successfully');

        // Create player_inventories table
        console.log('Creating player_inventories table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS player_inventories (
                inventory_id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                item_id VARCHAR(50) NOT NULL REFERENCES items(id),
                quantity INTEGER DEFAULT 1,
                equipped BOOLEAN DEFAULT FALSE,
                acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(wallet_address, item_id)
            );
        `);
        console.log('Player inventories table created successfully');

        // Create index on wallet_address for faster inventory lookups
        console.log('Creating index on player_inventories(wallet_address)...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_player_inventories_wallet_address 
            ON player_inventories(wallet_address);
        `);
        console.log('Index on player_inventories(wallet_address) created successfully');

        // Create index on (wallet_address, equipped) for faster equip/unequip operations
        console.log('Creating index on player_inventories(wallet_address, equipped)...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_player_inventories_wallet_equipped 
            ON player_inventories(wallet_address, equipped);
        `);
        console.log('Index on player_inventories(wallet_address, equipped) created successfully');

        // Create outfit_loadouts table
        console.log('Creating outfit_loadouts table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS outfit_loadouts (
                loadout_id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                name VARCHAR(100) NOT NULL,
                body_item VARCHAR(50) REFERENCES items(id),
                eyes_item VARCHAR(50) REFERENCES items(id),
                fur_item VARCHAR(50) REFERENCES items(id),
                head_item VARCHAR(50) REFERENCES items(id),
                minipet_item VARCHAR(50) REFERENCES items(id),
                misc_item VARCHAR(50) REFERENCES items(id),
                mouth_item VARCHAR(50) REFERENCES items(id),
                nose_item VARCHAR(50) REFERENCES items(id),
                skin_item VARCHAR(50) REFERENCES items(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT FALSE
            );
        `);
        console.log('Outfit loadouts table created successfully');

        // Create index on outfit_loadouts(wallet_address, is_active) for faster active loadout lookups
        console.log('Creating index on outfit_loadouts(wallet_address, is_active)...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_outfit_loadouts_wallet_active ON outfit_loadouts(wallet_address, is_active);
        `);
        console.log('Index on outfit_loadouts(wallet_address, is_active) created successfully');

        // Create initial items
        console.log('Creating initial items...');
        await client.query(`
            INSERT INTO items (id, name, description, category, sub_category, rarity, price, image_url, preview_url)
            VALUES 
                ('musketeer', 'Musketeer Hat', 'A dashing hat worn by brave musketeers', 'outfits', 'head', 'rare', 1000, '/items/Head/Musketeer.png', '/items/Head/Musketeer.svg'),
                ('bandage', 'Bandage', 'A simple bandage wrap for your head', 'outfits', 'head', 'premium', 250, '/items/Head/Bandage.png', '/items/Head/Bandage.svg'),
                ('brown_hat', 'Brown Hat', 'A stylish brown hat for casual wear', 'outfits', 'head', 'normal', 400, '/items/Head/Brown_hat.png', '/items/Head/Brown_hat.svg'),
                ('halo', 'Halo', 'A divine halo that glows above your head', 'outfits', 'head', 'premium', 300, '/items/Head/Halo.png', '/items/Head/Halo.svg'),
                ('bow', 'Bow', 'A cute bow to accessorize your look', 'outfits', 'head', 'normal', 200, '/items/Head/Bow.png', '/items/Head/Bow.svg'),
                ('toga', 'Toga', 'A majestic toga headpiece', 'outfits', 'head', 'rare', 1800, '/items/Head/Toga.png', '/items/Head/Toga.svg'),
                ('swag', 'Swag Eyes', 'Cool and stylish eyes', 'outfits', 'eyes', 'premium', 1200, '/items/Eyes/Swag.png', '/items/Eyes/Swag.svg'),
                ('coolglass', 'Cool Glass', 'Trendy sunglasses for a cool look', 'outfits', 'eyes', 'normal', 400, '/items/Eyes/CoolGlass.png', '/items/Eyes/CoolGlass.svg'),
                ('grumpy', 'Grumpy Eyes', 'Adorably grumpy expression', 'outfits', 'eyes', 'normal', 200, '/items/Eyes/Grumpy.png', '/items/Eyes/Grumpy.svg'),
                ('sparklyeyes', 'Sparkly Eyes', 'Eyes that twinkle with joy', 'outfits', 'eyes', 'premium', 2200, '/items/Eyes/SparklyEyes.png', '/items/Eyes/SparklyEyes.svg'),
                ('dizzy', 'Dizzy Eyes', 'Spinning stars in your eyes', 'outfits', 'eyes', 'normal', 400, '/items/Eyes/dizzy.png', '/items/Eyes/dizzy.svg'),
                ('huh', 'Huh Eyes', 'A confused and curious expression', 'outfits', 'eyes', 'normal', 350, '/items/Eyes/Huh.png', '/items/Eyes/Huh.svg'),
                ('bored', 'Bored Eyes', 'An unimpressed expression', 'outfits', 'eyes', 'normal', 250, '/items/Eyes/Bored.png', '/items/Eyes/Bored.svg'),
                ('innocent', 'Innocent Eyes', 'Pure and innocent looking eyes', 'outfits', 'eyes', 'normal', 250, '/items/Eyes/Innocent.png', '/items/Eyes/Innocent.svg'),
                ('haha', 'Haha Mouth', 'A cheerful laughing mouth', 'outfits', 'mouth', 'premium', 250, '/items/Mouth/Haha.png', '/items/Mouth/Haha.svg'),
                ('smileysnug', 'Smiley Snug', 'A warm and cozy smile', 'outfits', 'mouth', 'normal', 200, '/items/Mouth/SmileySnug.png', '/items/Mouth/SmileySnug.svg'),
                ('pout', 'Pout', 'A cute pouty expression', 'outfits', 'mouth', 'normal', 250, '/items/Mouth/Pout.png', '/items/Mouth/Pout.svg'),
                ('tinytooth', 'Tiny Tooth', 'An adorable tiny tooth smile', 'outfits', 'mouth', 'normal', 300, '/items/Mouth/TinyTooth.png', '/items/Mouth/TinyTooth.svg'),
                ('chomp', 'Chomp', 'A playful chomping expression', 'outfits', 'mouth', 'normal', 200, '/items/Mouth/Chomp.png', '/items/Mouth/Chomp.svg'),
                ('clownnose', 'Clown Nose', 'A fun and playful red clown nose', 'outfits', 'nose', 'normal', 500, '/items/Nose/ClownNose.png', '/items/Nose/ClownNose.svg'),
                ('baldeagle', 'Bald Eagle', 'A majestic bald eagle that soars beside you', 'outfits', 'minipet', 'rare', 1800, '/Mini pets/Baldeagle/1.svg', '/Mini pets/Baldeagle/1.svg'),
                ('bug', 'Bug', 'A cute little bug that buzzes around you', 'outfits', 'minipet', 'normal', 800, '/Mini pets/Bug/1.svg', '/Mini pets/Bug/1.svg'),
                ('devil', 'Devil', 'A mischievous devil that follows your every move', 'outfits', 'minipet', 'ultra_rare', 2800, '/Mini pets/Devil/1.svg', '/Mini pets/Devil/1.svg'),
                ('dodo', 'Dodo', 'A rare dodo bird that waddles alongside you', 'outfits', 'minipet', 'premium', 2200, '/Mini pets/Dodo/1.svg', '/Mini pets/Dodo/1.svg'),
                ('donkey', 'Donkey', 'A friendly donkey that trots beside you', 'outfits', 'minipet', 'premium', 1000, '/Mini pets/Donkey/1.svg', '/Mini pets/Donkey/1.svg'),
                ('elephant', 'Elephant', 'A gentle elephant that accompanies you', 'outfits', 'minipet', 'rare', 1900, '/Mini pets/Elephant/1.svg', '/Mini pets/Elephant/1.svg'),
                ('falcon', 'Falcon', 'A swift falcon that circles around you', 'outfits', 'minipet', 'premium', 1600, '/Mini pets/Falcon/1.svg', '/Mini pets/Falcon/1.svg'),
                ('octopus', 'Octopus', 'A clever octopus that floats beside you', 'outfits', 'minipet', 'premium', 1700, '/Mini pets/Octopus/1.svg', '/Mini pets/Octopus/1.svg'),
                ('owl', 'Owl', 'A wise owl that watches over you', 'outfits', 'minipet', 'premium', 1400, '/Mini pets/Owl/1.svg', '/Mini pets/Owl/1.svg'),
                ('phoenix', 'Phoenix', 'A legendary phoenix that blazes by your side', 'outfits', 'minipet', 'ultra_rare', 3000, '/Mini pets/Phoenix/1.svg', '/Mini pets/Phoenix/1.svg'),
                ('pig', 'Pig', 'A cheerful pig that bounces along with you', 'outfits', 'minipet', 'premium', 900, '/Mini pets/Pig/1.svg', '/Mini pets/Pig/1.svg'),
                ('polar_bear', 'Polar Bear', 'A cuddly polar bear that waddles beside you', 'outfits', 'minipet', 'premium', 2000, '/Mini pets/Polar Bear/1.svg', '/Mini pets/Polar Bear/1.svg'),
                ('puffin', 'Puffin', 'A charming puffin that glides alongside you', 'outfits', 'minipet', 'premium', 1300, '/Mini pets/Puffin/1.svg', '/Mini pets/Puffin/1.svg'),
                ('reaper', 'Reaper', 'A mysterious reaper that lurks in your shadow', 'outfits', 'minipet', 'ultra_rare', 2900, '/Mini pets/Reaper/1.svg', '/Mini pets/Reaper/1.svg'),
                ('red_parrot', 'Red Parrot', 'A loyal red parrot companion that follows you around', 'outfits', 'minipet', 'premium', 1500, '/Mini pets/Red Parrot/1.svg', '/Mini pets/Red Parrot/1.svg'),
                ('robot', 'Robot', 'A mechanical companion that hovers by your side', 'outfits', 'minipet', 'ultra_rare', 2500, '/Mini pets/Robot/1.svg', '/Mini pets/Robot/1.svg'),
                ('snake', 'Snake', 'A slithering snake that winds around you', 'outfits', 'minipet', 'premium', 1200, '/Mini pets/Snake/1.svg', '/Mini pets/Snake/1.svg'),
                ('turkey', 'Turkey', 'A proud turkey that struts beside you', 'outfits', 'minipet', 'premium', 1100, '/Mini pets/Turkey/1.svg', '/Mini pets/Turkey/1.svg'),
                ('turtle', 'Turtle', 'A steady turtle that follows in your footsteps', 'outfits', 'minipet', 'rare', 1000, '/Mini pets/Turtle/1.svg', '/Mini pets/Turtle/1.svg'),
                ('walrus', 'Walrus', 'A jolly walrus that bounces along with you', 'outfits', 'minipet', 'premium', 1400, '/Mini pets/Walrus/1.svg', '/Mini pets/Walrus/1.svg'),
                ('witch', 'Witch', 'A mystical witch that floats by your side', 'outfits', 'minipet', 'ultra_rare', 2700, '/Mini pets/Witch/1.svg', '/Mini pets/Witch/1.svg'),
                ('zombie_bird', 'Zombie Bird', 'An undead bird that haunts your path', 'outfits', 'minipet', 'ultra_rare', 2400, '/Mini pets/Zombie Bird/1.svg', '/Mini pets/Zombie Bird/1.svg'),
                ('red_skin', 'Red Skin', 'A vibrant red character skin', 'outfits', 'skin', 'normal', 0, '/items/red_skin.svg', '/items/red_skin.svg'),
                ('blue_skin', 'Blue Skin', 'A cool blue character skin', 'outfits', 'skin', 'normal', 0, '/items/blue_skin.svg', '/items/blue_skin.svg'),
                ('green_skin', 'Green Skin', 'A fresh green character skin', 'outfits', 'skin', 'normal', 0, '/items/green_skin.svg', '/items/green_skin.svg'),
                ('yellow_skin', 'Yellow Skin', 'A bright yellow character skin', 'outfits', 'skin', 'normal', 0, '/items/yellow_skin.svg', '/items/yellow_skin.svg'),
                ('team_skin', 'Team Skin', 'Show your team spirit!', 'outfits', 'skin', 'ultra_rare', 0, '/items/team_skin.svg', '/items/team_skin.svg')
            ON CONFLICT (id) DO UPDATE 
            SET 
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                sub_category = EXCLUDED.sub_category,
                rarity = EXCLUDED.rarity,
                price = EXCLUDED.price,
                image_url = EXCLUDED.image_url,
                preview_url = EXCLUDED.preview_url;
        `);
        console.log('Initial items created successfully');

        // Give all items to specific user
        console.log('Giving items to user...');
        const targetWallet = '0xdCdcC0643F2b7336030cD46fDE8bc00c8Ea74547'.toLowerCase();
        
        // First ensure the user exists
        await client.query(`
            INSERT INTO users (wallet_address, username)
            VALUES ($1, $2)
            ON CONFLICT (wallet_address) DO UPDATE
            SET last_login = CURRENT_TIMESTAMP
            RETURNING wallet_address
        `, [targetWallet, `Player_${targetWallet.slice(0, 6)}`]);

        // Ensure user profile exists
        await client.query(`
            INSERT INTO player_profiles (wallet_address)
            VALUES ($1)
            ON CONFLICT (wallet_address) DO UPDATE
            SET last_updated = CURRENT_TIMESTAMP
        `, [targetWallet]);

        // Give all items to the user
        await client.query(`
            INSERT INTO player_inventories (wallet_address, item_id, quantity, equipped)
            SELECT $1, id, 10, false
            FROM items
            ON CONFLICT (wallet_address, item_id) 
            DO UPDATE SET quantity = 10;
        `, [targetWallet]);
        console.log('Items given to user successfully');

        // Create function to give default items to new players
        console.log('Creating function for default items...');
        await client.query(`
            CREATE OR REPLACE FUNCTION give_default_items()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Insert default items into player's inventory
                INSERT INTO player_inventories (wallet_address, item_id, quantity, equipped)
                VALUES
                    (NEW.wallet_address, 'red_skin', 1, false),
                    (NEW.wallet_address, 'blue_skin', 1, false),
                    (NEW.wallet_address, 'green_skin', 1, false),
                    (NEW.wallet_address, 'yellow_skin', 1, false)
                ON CONFLICT (wallet_address, item_id) 
                DO UPDATE SET 
                    quantity = player_inventories.quantity + 1
                WHERE player_inventories.wallet_address = NEW.wallet_address;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger to automatically give default items to new players
        console.log('Creating trigger for default items...');
        await client.query(`
            DROP TRIGGER IF EXISTS give_default_items_trigger ON player_profiles;
            CREATE TRIGGER give_default_items_trigger
            AFTER INSERT ON player_profiles
            FOR EACH ROW
            EXECUTE FUNCTION give_default_items();
        `);
        console.log('Default items trigger created successfully');

        // Create chat_messages table
        console.log('Creating chat_messages table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                sender_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
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

        // Create trade_history table
        console.log('Creating trade_history table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_history (
                id SERIAL PRIMARY KEY,
                trade_id VARCHAR(255) NOT NULL,
                seller_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                buyer_address VARCHAR(44) REFERENCES users(wallet_address),
                status VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                UNIQUE(trade_id)
            );
        `);
        console.log('Trade history table created successfully');

        // Create trade_items table
        console.log('Creating trade_items table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_items (
                id SERIAL PRIMARY KEY,
                trade_id VARCHAR(255) NOT NULL,
                item_id VARCHAR(50) NOT NULL REFERENCES items(id),
                from_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                to_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                quantity INTEGER NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trade_id) REFERENCES trade_history(trade_id)
            );
        `);
        console.log('Trade items table created successfully');

        // Create trade_negotiations table
        console.log('Creating trade_negotiations table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_negotiations (
                id SERIAL PRIMARY KEY,
                trade_id VARCHAR(255) NOT NULL,
                seller_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                buyer_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                status VARCHAR(50) NOT NULL DEFAULT 'waiting',
                seller_locked BOOLEAN DEFAULT FALSE,
                buyer_locked BOOLEAN DEFAULT FALSE,
                seller_items JSONB DEFAULT '[]'::jsonb,
                buyer_items JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP WITH TIME ZONE,
                FOREIGN KEY (trade_id) REFERENCES trade_history(trade_id),
                CONSTRAINT valid_seller_items CHECK (jsonb_typeof(seller_items) = 'array'),
                CONSTRAINT valid_buyer_items CHECK (jsonb_typeof(buyer_items) = 'array')
            );
        `);
        console.log('Trade negotiations table created successfully');

        // Add columns to trade_negotiations table if they don't exist
        console.log('Adding columns to trade_negotiations table if they dont exist...');
        await client.query(`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE trade_negotiations 
                    ADD COLUMN IF NOT EXISTS seller_items JSONB DEFAULT '[]'::jsonb;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;

                BEGIN
                    ALTER TABLE trade_negotiations 
                    ADD COLUMN IF NOT EXISTS buyer_items JSONB DEFAULT '[]'::jsonb;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `);

        // Create trade_chat_messages table
        console.log('Creating trade_chat_messages table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS trade_chat_messages (
                id SERIAL PRIMARY KEY,
                trade_id VARCHAR(255) NOT NULL,
                sender_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address),
                message TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trade_id) REFERENCES trade_history(trade_id)
            );
        `);
        console.log('Trade chat messages table created successfully');

        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_trade_history_seller ON trade_history(seller_address);
            CREATE INDEX IF NOT EXISTS idx_trade_history_buyer ON trade_history(buyer_address);
            CREATE INDEX IF NOT EXISTS idx_trade_items_trade_id ON trade_items(trade_id);
            CREATE INDEX IF NOT EXISTS idx_trade_negotiations_trade_id ON trade_negotiations(trade_id);
            CREATE INDEX IF NOT EXISTS idx_trade_chat_messages_trade_id ON trade_chat_messages(trade_id);
        `);

        // Create function to update trade negotiation status
        console.log('Creating function to update trade negotiation status...');
        await client.query(`
            CREATE OR REPLACE FUNCTION update_trade_negotiation_status()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Always update the timestamp
                NEW.updated_at = CURRENT_TIMESTAMP;
                
                -- Only update status based on locks if it's not already being set to a terminal state
                IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'cancelled' OR NEW.status = 'completed') THEN
                    -- If the UPDATE statement is explicitly setting to cancelled or completed, keep that value
                    RETURN NEW;
                ELSE
                    -- Otherwise, determine status based on locks
                    IF NEW.seller_locked AND NEW.buyer_locked THEN
                        NEW.status = 'locked';
                    ELSE
                        NEW.status = 'waiting';
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger for trade negotiation status updates
        console.log('Creating trigger for trade negotiation status updates...');
        await client.query(`
            DROP TRIGGER IF EXISTS trade_negotiation_status_trigger ON trade_negotiations;
            CREATE TRIGGER trade_negotiation_status_trigger
                BEFORE UPDATE ON trade_negotiations
                FOR EACH ROW
                EXECUTE FUNCTION update_trade_negotiation_status();
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