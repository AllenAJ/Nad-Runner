import { Category, Item, Rarity, SubCategory } from '../types/inventory';

export const CATEGORIES: Category[] = ['outfits', 'powerups'];

export const SUB_CATEGORIES: Record<Category, SubCategory[]> = {
    outfits: ['head', 'body', 'legs', 'feet', 'skin'],
    powerups: ['speed', 'jump', 'shield']
};

export const ITEM_CATEGORIES = {
    OUTFIT: {
        HEAD: 'head',
        BODY: 'body',
        LEGS: 'legs',
        FEET: 'feet',
        SKIN: 'skin'
    },
    POWERUPS: {
        SPEED: 'speed',
        JUMP: 'jump',
        SHIELD: 'shield'
    },
    RARITY: {
        NORMAL: 'normal',
        PREMIUM: 'premium',
        RARE: 'rare',
        EVENT_RARE: 'event_rare',
        ULTRA_RARE: 'ultra_rare',
        TRADE_CASH: 'trade_cash'
    }
} as const;

export const RARITY_COLORS: Record<Rarity, string> = {
    normal: '#cccccc',
    premium: '#4834d4',
    rare: '#6c5ce7',
    event_rare: '#e056fd',
    ultra_rare: '#ff7675',
    trade_cash: '#ffeaa7'
};

export const INITIAL_ITEMS: Item[] = [
    {
        id: 'red_skin',
        key: 'red_skin',
        name: 'Red Skin',
        description: 'A vibrant red character skin',
        category: 'outfits',
        subCategory: 'skin',
        rarity: 'normal',
        price: 0,
        imageUrl: '/items/red_skin.svg',
        purchaseDate: new Date(),
        color: '#8B3A3A'
    },
    {
        id: 'blue_skin',
        key: 'blue_skin',
        name: 'Blue Skin',
        description: 'A cool blue character skin',
        category: 'outfits',
        subCategory: 'skin',
        rarity: 'normal',
        price: 0,
        imageUrl: '/items/blue_skin.svg',
        purchaseDate: new Date(),
        color: '#4A6B8A'
    },
    {
        id: 'green_skin',
        key: 'green_skin',
        name: 'Green Skin',
        description: 'A fresh green character skin',
        category: 'outfits',
        subCategory: 'skin',
        rarity: 'normal',
        price: 0,
        imageUrl: '/items/green_skin.svg',
        purchaseDate: new Date(),
        color: '#4F7942'
    },
    {
        id: 'yellow_skin',
        key: 'yellow_skin',
        name: 'Yellow Skin',
        description: 'A bright yellow character skin',
        category: 'outfits',
        subCategory: 'skin',
        rarity: 'normal',
        price: 0,
        imageUrl: '/items/yellow_skin.svg',
        purchaseDate: new Date(),
        color: '#B8860B'
    },
    {
        id: 'basic_helmet',
        key: 'basic_helmet',
        name: 'Basic Helmet',
        description: 'A simple protective helmet',
        category: 'outfits',
        subCategory: 'head',
        rarity: 'normal',
        price: 100,
        imageUrl: '/items/basic_helmet.png',
        purchaseDate: new Date()
    },
    {
        id: 'speed_boost',
        key: 'speed_boost',
        name: 'Speed Boost',
        description: 'Increases movement speed by 20%',
        category: 'powerups',
        subCategory: 'speed',
        rarity: 'premium',
        price: 500,
        effects: {
            speed: 1.2
        },
        purchaseDate: new Date()
    },
    {
        id: 'super_jump',
        key: 'super_jump',
        name: 'Super Jump',
        description: 'Increases jump height by 50%',
        category: 'powerups',
        subCategory: 'jump',
        rarity: 'rare',
        price: 1000,
        effects: {
            jump: 1.5
        },
        purchaseDate: new Date()
    },
    {
        id: 'energy_shield',
        key: 'energy_shield',
        name: 'Energy Shield',
        description: 'Protects from one hit',
        category: 'powerups',
        subCategory: 'shield',
        rarity: 'event_rare',
        price: 2000,
        effects: {
            shield: 1
        },
        purchaseDate: new Date()
    }
];

export const MAX_EQUIPPED_POWERUPS = 3;
export const MAX_OUTFIT_LOADOUTS = 5; 