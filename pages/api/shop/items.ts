// pages/api/shop/items.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Define types for items
interface ShopItem {
    id: string;
    name: string;
    description: string;
    category: string;
    sub_category: string;
    rarity: string;
    price: number; // Coin price for normal items
    image_url: string;
    preview_url: string;
    color?: string;
    type: 'normal' | 'premium'; // Indicate purchase type
    owned: boolean; // Does the current user own this item?
}

interface ErrorResponse {
    error: string;
}

// Define items for each section by their IDs
const NORMAL_ITEMS = [
    // Head Items
    'brown_hat',    // Brown Hat
    'bow',          // Bow
    'musketeer',    // Musketeer Hat

    // Eyes Items
    'coolglass',    // Cool Glass
    'grumpy',       // Grumpy Eyes
    'dizzy',        // Dizzy Eyes
    'huh',          // Huh Eyes
    'bored',        // Bored Eyes
    'innocent',     // Innocent Eyes

    // Mouth Items
    'smileysnug',   // Smiley Snug
    'pout',         // Pout
    'tinytooth',    // Tiny Tooth
    'chomp',        // Chomp

    // Nose Items
    'clownnose',    // Clown Nose

    // Mini Pets
    'bug',          // Bug

    // Skins
    // 'red_skin',     // Red Skin
    // 'blue_skin',    // Blue Skin
    // 'green_skin',   // Green Skin
    // 'yellow_skin'   // Yellow Skin
];

const PREMIUM_ITEMS = [
    // Head Items
    'bandage',      // Bandage
    'halo',         // Halo

    // Eyes Items
    'swag',         // Swag Eyes
    'sparklyeyes',  // Sparkly Eyes

    // Mouth Items
    'haha',         // Haha Mouth

    // Mini Pets
    'dodo',         // Dodo
    'donkey',       // Donkey
    'falcon',       // Falcon
    'octopus',      // Octopus
    'owl',          // Owl
    'pig',          // Pig
    'polar_bear',   // Polar Bear
    'puffin',       // Puffin
    'red_parrot',   // Red Parrot
    'snake',        // Snake
    'turkey',       // Turkey
    'walrus'        // Walrus
];

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ShopItem[] | ErrorResponse>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Get wallet address from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const walletAddress = authHeader.split(' ')[1].trim().toLowerCase();
    
    if (!walletAddress) {
        return res.status(401).json({ error: 'Wallet address is required' });
    }

    const section = req.query.section as string | undefined;

    let itemIds: string[] = [];
    let itemType: 'normal' | 'premium' | undefined;

    if (section === 'normal') {
        itemIds = NORMAL_ITEMS;
        itemType = 'normal';
    } else if (section === 'premium') {
        itemIds = PREMIUM_ITEMS;
        itemType = 'premium';
    } else {
        // If no section or invalid section, return all items
        itemIds = [...NORMAL_ITEMS, ...PREMIUM_ITEMS];
    }

    if (itemIds.length === 0) {
        return res.status(200).json([]); 
    }

    const client = await pool.connect();
    try {
        // Get all items from the list
        const allItemsQuery = `
            SELECT 
                i.id, i.name, i.description, i.category, i.sub_category, 
                i.rarity, i.price, i.image_url, i.preview_url, i.color
            FROM items i
            WHERE i.id = ANY($1::VARCHAR[])
            ORDER BY i.rarity, i.name;
        `;
        const itemResult = await client.query(allItemsQuery, [itemIds]);
        
        // Get owned items for this user
        const ownedItemsQuery = `
            SELECT item_id FROM player_inventories 
            WHERE wallet_address = $1 AND item_id = ANY($2::VARCHAR[]);
        `;
        const ownedResult = await client.query(ownedItemsQuery, [walletAddress, itemIds]);
        
        // Create a set of owned item IDs for quick lookup
        const ownedItemIds = new Set(ownedResult.rows.map(row => row.item_id));
        
        // Map the results to include type and ownership
        const shopItems: ShopItem[] = itemResult.rows.map(item => ({
            ...item,
            type: NORMAL_ITEMS.includes(item.id) ? 'normal' : 'premium',
            owned: ownedItemIds.has(item.id)
        }));
        
        return res.status(200).json(shopItems);
    } catch (error) {
        console.error('Error fetching shop items:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
} 