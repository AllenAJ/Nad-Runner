import { ITEM_CATEGORIES } from '../constants/inventory';

export type ItemCategory = typeof ITEM_CATEGORIES.OUTFIT[keyof typeof ITEM_CATEGORIES.OUTFIT] |
                         typeof ITEM_CATEGORIES.POWERUPS[keyof typeof ITEM_CATEGORIES.POWERUPS] |
                         'head' | 'body' | 'legs' | 'feet' | 'skin' | 'speed' | 'jump' | 'shield';

export type ItemRarity = typeof ITEM_CATEGORIES.RARITY[keyof typeof ITEM_CATEGORIES.RARITY];

export type Rarity = 'normal' | 'premium' | 'rare' | 'event_rare' | 'ultra_rare' | 'trade_cash';

export type Category = 'outfits' | 'powerups';

export type SubCategory = 'head' | 'body' | 'legs' | 'feet' | 'skin' | 'speed' | 'jump' | 'shield';

export interface Item {
    id: string;
    key: string;
    name: string;
    description: string;
    category: Category;
    subCategory: SubCategory;
    rarity: Rarity;
    imageUrl?: string;
    price: number;
    effects?: {
        [key: string]: number;
    };
    purchaseDate?: Date;
    color?: string;
}

export interface ShopItem {
    key: string;
    price: number;
    name: string;
    desc: string;
    category: ItemCategory;
    rarity: ItemRarity;
}

export interface OutfitLoadout {
    id: string;
    name: string;
    head?: string;
    body?: string;
    legs?: string;
    feet?: string;
}

export interface ItemCounts {
    [key: string]: number;
}

export interface InventoryState {
    items: { [key: string]: number }; // itemId -> count
    outfitLoadouts: OutfitLoadout[];
    activeLoadoutId?: string;
    equippedPowerups: string[]; // itemIds of equipped powerups
}

export interface InventoryContextType {
    items: { [key: string]: number };
    itemCounts: { [key: string]: number };
    outfitLoadouts: OutfitLoadout[];
    activeLoadoutId?: string;
    equippedPowerups: string[];
    addItem: (itemId: string, count?: number) => void;
    removeItem: (itemId: string, count?: number) => void;
    hasItem: (itemId: string) => boolean;
    getItemCount: (itemId: string) => number;
    createOutfitLoadout: (name: string) => void;
    deleteOutfitLoadout: (id: string) => void;
    updateOutfitLoadout: (loadout: OutfitLoadout) => void;
    setActiveLoadout: (id: string) => void;
    equipPowerup: (itemId: string) => void;
    unequipPowerup: (itemId: string) => void;
    getItemsByCategory: (category: ItemCategory) => Item[];
    countItem: (itemId: string) => number;
    isLoading: boolean;
} 