import { Category, Item, Rarity, SubCategory } from '../types/inventory';

export const CATEGORIES: Category[] = ['outfits', 'powerups'];

export const SUB_CATEGORIES: Record<Category, SubCategory[]> = {
    outfits: ['body', 'eyes', 'fur', 'head', 'minipet', 'misc', 'mouth', 'nose', 'skin'],
    powerups: ['speed', 'jump', 'shield']
};

export const ITEM_CATEGORIES = {
    OUTFIT: {
        BODY: 'body',
        EYES: 'eyes',
        FUR: 'fur',
        HEAD: 'head',
        MINIPET: 'minipet',
        MISC: 'misc',
        MOUTH: 'mouth',
        NOSE: 'nose',
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
        id: 'baldeagle',
        key: 'baldeagle',
        name: 'Bald Eagle',
        description: 'A majestic bald eagle that soars beside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'rare',
        price: 1800,
        imageUrl: '/Mini pets/Baldeagle/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'bug',
        key: 'bug',
        name: 'Bug',
        description: 'A cute little bug that buzzes around you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'normal',
        price: 800,
        imageUrl: '/Mini pets/Bug/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'devil',
        key: 'devil',
        name: 'Devil',
        description: 'A mischievous devil that follows your every move',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'ultra_rare',
        price: 2800,
        imageUrl: '/Mini pets/Devil/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'dodo',
        key: 'dodo',
        name: 'Dodo',
        description: 'A rare dodo bird that waddles alongside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'event_rare',
        price: 2200,
        imageUrl: '/Mini pets/Dodo/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'donkey',
        key: 'donkey',
        name: 'Donkey',
        description: 'A friendly donkey that trots beside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'normal',
        price: 1000,
        imageUrl: '/Mini pets/Donkey/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'elephant',
        key: 'elephant',
        name: 'Elephant',
        description: 'A gentle elephant that accompanies you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'rare',
        price: 1900,
        imageUrl: '/Mini pets/Elephant/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'falcon',
        key: 'falcon',
        name: 'Falcon',
        description: 'A swift falcon that circles around you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'premium',
        price: 1600,
        imageUrl: '/Mini pets/Falcon/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'octopus',
        key: 'octopus',
        name: 'Octopus',
        description: 'A clever octopus that floats beside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'rare',
        price: 1700,
        imageUrl: '/Mini pets/Octopus/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'owl',
        key: 'owl',
        name: 'Owl',
        description: 'A wise owl that watches over you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'premium',
        price: 1400,
        imageUrl: '/Mini pets/Owl/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'phoenix',
        key: 'phoenix',
        name: 'Phoenix',
        description: 'A legendary phoenix that blazes by your side',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'ultra_rare',
        price: 3000,
        imageUrl: '/Mini pets/Phoenix/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'pig',
        key: 'pig',
        name: 'Pig',
        description: 'A cheerful pig that bounces along with you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'normal',
        price: 900,
        imageUrl: '/Mini pets/Pig/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'polar_bear',
        key: 'polar_bear',
        name: 'Polar Bear',
        description: 'A cuddly polar bear that waddles beside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'rare',
        price: 2000,
        imageUrl: '/Mini pets/Polar Bear/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'puffin',
        key: 'puffin',
        name: 'Puffin',
        description: 'A charming puffin that glides alongside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'premium',
        price: 1300,
        imageUrl: '/Mini pets/Puffin/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'reaper',
        key: 'reaper',
        name: 'Reaper',
        description: 'A mysterious reaper that lurks in your shadow',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'ultra_rare',
        price: 2900,
        imageUrl: '/Mini pets/Reaper/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'red_parrot',
        key: 'red_parrot',
        name: 'Red Parrot',
        description: 'A loyal red parrot companion that follows you around',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'rare',
        price: 1500,
        imageUrl: '/Mini pets/Red Parrot/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'robot',
        key: 'robot',
        name: 'Robot',
        description: 'A mechanical companion that hovers by your side',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'ultra_rare',
        price: 2500,
        imageUrl: '/Mini pets/Robot/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'snake',
        key: 'snake',
        name: 'Snake',
        description: 'A slithering snake that winds around you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'premium',
        price: 1200,
        imageUrl: '/Mini pets/Snake/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'turkey',
        key: 'turkey',
        name: 'Turkey',
        description: 'A proud turkey that struts beside you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'normal',
        price: 1100,
        imageUrl: '/Mini pets/Turkey/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'turtle',
        key: 'turtle',
        name: 'Turtle',
        description: 'A steady turtle that follows in your footsteps',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'normal',
        price: 1000,
        imageUrl: '/Mini pets/Turtle/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'walrus',
        key: 'walrus',
        name: 'Walrus',
        description: 'A jolly walrus that bounces along with you',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'premium',
        price: 1400,
        imageUrl: '/Mini pets/Walrus/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'witch',
        key: 'witch',
        name: 'Witch',
        description: 'A mystical witch that floats by your side',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'ultra_rare',
        price: 2700,
        imageUrl: '/Mini pets/Witch/1.svg',
        purchaseDate: new Date()
    },
    {
        id: 'zombie_bird',
        key: 'zombie_bird',
        name: 'Zombie Bird',
        description: 'An undead bird that haunts your path',
        category: 'outfits',
        subCategory: 'minipet',
        rarity: 'event_rare',
        price: 2400,
        imageUrl: '/Mini pets/Zombie Bird/1.svg',
        purchaseDate: new Date()
    },
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
    },
    {
        id: 'smileysnug',
        key: 'smileysnug',
        name: 'Smiley Snug',
        description: 'A warm and cozy smile',
        category: 'outfits',
        subCategory: 'mouth',
        rarity: 'premium',
        price: 1200,
        imageUrl: '/items/Mouth/SmileySnug.png',
        purchaseDate: new Date()
    },
    {
        id: 'pout',
        key: 'pout',
        name: 'Pout',
        description: 'A cute pouty expression',
        category: 'outfits',
        subCategory: 'mouth',
        rarity: 'rare',
        price: 1500,
        imageUrl: '/items/Mouth/Pout.png',
        purchaseDate: new Date()
    },
    {
        id: 'tinytooth',
        key: 'tinytooth',
        name: 'Tiny Tooth',
        description: 'An adorable tiny tooth smile',
        category: 'outfits',
        subCategory: 'mouth',
        rarity: 'normal',
        price: 800,
        imageUrl: '/items/Mouth/TinyTooth.png',
        purchaseDate: new Date()
    },
    {
        id: 'chomp',
        key: 'chomp',
        name: 'Chomp',
        description: 'A playful chomping expression',
        category: 'outfits',
        subCategory: 'mouth',
        rarity: 'ultra_rare',
        price: 2000,
        imageUrl: '/items/Mouth/Chomp.png',
        purchaseDate: new Date()
    }
];

export const MAX_EQUIPPED_POWERUPS = 3;
export const MAX_OUTFIT_LOADOUTS = 5; 