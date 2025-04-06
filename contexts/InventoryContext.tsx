import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Item, ItemCategory, Rarity, ItemCounts, OutfitLoadout, InventoryContextType } from '../types/inventory';
import { useAccount } from 'wagmi';

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const useInventory = () => {
    const context = useContext(InventoryContext);
    if (!context) {
        throw new Error('useInventory must be used within an InventoryProvider');
    }
    return context;
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { address } = useAccount();
    const [items, setItems] = useState<{ [key: string]: number }>({});
    const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
    const [outfitLoadouts, setOutfitLoadouts] = useState<OutfitLoadout[]>([]);
    const [activeLoadoutId, setActiveLoadoutId] = useState<string>();
    const [equippedPowerups, setEquippedPowerups] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch inventory items from the database
    useEffect(() => {
        const fetchInventory = async () => {
            if (!address) {
                setItems({});
                setInventoryItems([]);
                setIsLoading(false);
                return;
            }

            try {
                // Convert wallet address to lowercase for consistency
                const normalizedAddress = address.toLowerCase();
                const response = await fetch(`/api/inventory/items?walletAddress=${normalizedAddress}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch inventory');
                }

                const data = await response.json();
                const newItems: { [key: string]: number } = {};
                data.items.forEach((item: any) => {
                    newItems[item.id] = item.quantity;
                });

                setItems(newItems);
                setInventoryItems(data.items);
            } catch (error) {
                console.error('Error fetching inventory:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInventory();
    }, [address]);

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
        return inventoryItems.filter(item => item.subCategory === category);
    }, [inventoryItems]);

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
    const itemCounts = inventoryItems.reduce((counts: ItemCounts, item) => {
        counts[item.rarity] = (counts[item.rarity] || 0) + (items[item.id] || 0);
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
        countItem,
        isLoading
    };

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
}; 