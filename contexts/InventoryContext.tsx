import React, { createContext, useContext, useState, useCallback } from 'react';
import { INITIAL_ITEMS, ITEM_CATEGORIES } from '../constants/inventory';
import { Item, ItemCategory, Rarity, ItemCounts, OutfitLoadout, InventoryContextType } from '../types/inventory';

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize with INITIAL_ITEMS mapped to counts
    const [items, setItems] = useState<{ [key: string]: number }>(() => {
        const initialCounts: { [key: string]: number } = {
            'red_skin': 1,
            'blue_skin': 1,
            'green_skin': 1,
            'yellow_skin': 1
        };
        INITIAL_ITEMS.forEach(item => {
            if (!initialCounts[item.id]) {
                initialCounts[item.id] = 1;
            }
        });
        return initialCounts;
    });

    const [outfitLoadouts, setOutfitLoadouts] = useState<OutfitLoadout[]>([]);
    const [activeLoadoutId, setActiveLoadoutId] = useState<string>();
    const [equippedPowerups, setEquippedPowerups] = useState<string[]>([]);

    const addItem = useCallback((itemId: string, count: number = 1) => {
        setItems(prev => ({
            ...prev,
            [itemId]: (prev[itemId] || 0) + count
        }));
    }, []);

    const removeItem = useCallback((itemId: string, count: number = 1) => {
        setItems(prev => {
            const currentCount = prev[itemId] || 0;
            if (currentCount <= count) {
                const { [itemId]: _, ...rest } = prev;
                return rest;
            }
            return {
                ...prev,
                [itemId]: currentCount - count
            };
        });
    }, []);

    const hasItem = useCallback((itemId: string): boolean => {
        return (items[itemId] || 0) > 0;
    }, [items]);

    const getItemCount = useCallback((itemId: string): number => {
        return items[itemId] || 0;
    }, [items]);

    const getItemsByCategory = useCallback((category: ItemCategory): Item[] => {
        console.log('Getting items for category:', category);
        console.log('Current items:', items);
        console.log('INITIAL_ITEMS:', INITIAL_ITEMS);
        const filteredItems = INITIAL_ITEMS.filter(item => {
            const hasItem = item.subCategory === category && items[item.id];
            console.log(`Item ${item.id}: subCategory=${item.subCategory}, hasItem=${hasItem}`);
            return hasItem;
        });
        console.log('Filtered items:', filteredItems);
        return filteredItems;
    }, [items]);

    const countItem = useCallback((itemId: string): number => {
        return items[itemId] || 0;
    }, [items]);

    const createOutfitLoadout = useCallback((name: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setOutfitLoadouts(prev => [...prev, { id, name }]);
    }, []);

    const deleteOutfitLoadout = useCallback((id: string) => {
        setOutfitLoadouts(prev => prev.filter(loadout => loadout.id !== id));
        if (activeLoadoutId === id) {
            setActiveLoadoutId(undefined);
        }
    }, [activeLoadoutId]);

    const updateOutfitLoadout = useCallback((loadout: OutfitLoadout) => {
        setOutfitLoadouts(prev => 
            prev.map(l => l.id === loadout.id ? loadout : l)
        );
    }, []);

    const setActiveLoadout = useCallback((id: string) => {
        setActiveLoadoutId(id);
    }, []);

    const equipPowerup = useCallback((itemId: string) => {
        setEquippedPowerups(prev => [...prev, itemId]);
    }, []);

    const unequipPowerup = useCallback((itemId: string) => {
        setEquippedPowerups(prev => prev.filter(id => id !== itemId));
    }, []);

    // Calculate item counts by rarity
    const itemCounts = Object.entries(items).reduce((counts: ItemCounts, [itemId, count]) => {
        const item = INITIAL_ITEMS.find(i => i.id === itemId);
        if (item) {
            counts[item.rarity] = (counts[item.rarity] || 0) + count;
        }
        return counts;
    }, {});

    const value: InventoryContextType = {
        items,
        itemCounts,
        outfitLoadouts,
        activeLoadoutId,
        equippedPowerups,
        addItem,
        removeItem,
        hasItem,
        getItemCount,
        createOutfitLoadout,
        deleteOutfitLoadout,
        updateOutfitLoadout,
        setActiveLoadout,
        equipPowerup,
        unequipPowerup,
        getItemsByCategory,
        countItem
    };

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
}; 