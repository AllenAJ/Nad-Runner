import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Item, ItemCategory, Rarity, ItemCounts, OutfitLoadout, InventoryContextType, SubCategory } from '../types/inventory';
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
    const [equippedItems, setEquippedItems] = useState<{ [key in SubCategory]?: string }>({});

    // First, define the equipItem function before it's used by other functions
    const equipItem = useCallback(async (itemId: string, category: SubCategory, equipped: boolean = true) => {
        if (!address) return false;
        
        try {
            const response = await fetch('/api/inventory/equip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: address,
                    itemId: itemId,
                    equipped: equipped,
                    categoryType: category
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to equip item:', errorData);
                return false;
            }

            // Update local state to reflect the change
            setInventoryItems(prevItems => 
                prevItems.map(item => {
                    // If item is in the same category, unequip it
                    if (item.subCategory === category && item.id !== itemId) {
                        return { ...item, equipped: false };
                    }
                    // If this is the target item, set its equipped status
                    if (item.id === itemId) {
                        return { ...item, equipped: equipped };
                    }
                    return item;
                })
            );

            // Update equipped items state
            setEquippedItems(prev => ({
                ...prev,
                [category]: equipped ? itemId : undefined
            }));

            return true;
        } catch (error) {
            console.error('Error equipping item:', error);
            return false;
        }
    }, [address]);
    
    // Then define any other functions that depend on equipItem

    // Add a function to create a new loadout
    const createOutfitLoadout = useCallback(async (name: string) => {
        if (!address) return;
        
        try {
            // Create a new loadout using the current equipped items
            const loadoutData = {
                walletAddress: address,
                loadoutName: name,
                bodyItem: equippedItems.body,
                eyesItem: equippedItems.eyes,
                furItem: equippedItems.fur,
                headItem: equippedItems.head,
                minipetItem: equippedItems.minipet,
                miscItem: equippedItems.misc,
                mouthItem: equippedItems.mouth,
                noseItem: equippedItems.nose,
                skinItem: equippedItems.skin,
                isActive: false
            };
            
            const response = await fetch('/api/inventory/loadout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loadoutData),
            });
            
            if (!response.ok) {
                throw new Error('Failed to create loadout');
            }
            
            const result = await response.json();
            
            // Add the new loadout to state
            const newLoadout: OutfitLoadout = {
                id: result.loadoutId.toString(),
                name,
                body: equippedItems.body,
                eyes: equippedItems.eyes,
                fur: equippedItems.fur,
                head: equippedItems.head,
                minipet: equippedItems.minipet,
                misc: equippedItems.misc,
                mouth: equippedItems.mouth,
                nose: equippedItems.nose,
                skin: equippedItems.skin,
                isActive: false
            };
            
            setOutfitLoadouts(prev => [...prev, newLoadout]);
            
            return newLoadout;
        } catch (error) {
            console.error('Error creating outfit loadout:', error);
        }
    }, [address, equippedItems]);

    // Update an existing loadout
    const updateOutfitLoadout = useCallback(async (loadout: OutfitLoadout) => {
        if (!address) return;
        
        try {
            // Update the loadout with the current equipped items or specified loadout values
            const loadoutData = {
                walletAddress: address,
                loadoutId: loadout.id,
                loadoutName: loadout.name,
                bodyItem: loadout.body || equippedItems.body,
                eyesItem: loadout.eyes || equippedItems.eyes,
                furItem: loadout.fur || equippedItems.fur,
                headItem: loadout.head || equippedItems.head,
                minipetItem: loadout.minipet || equippedItems.minipet,
                miscItem: loadout.misc || equippedItems.misc,
                mouthItem: loadout.mouth || equippedItems.mouth,
                noseItem: loadout.nose || equippedItems.nose,
                skinItem: loadout.skin || equippedItems.skin,
                isActive: loadout.id === activeLoadoutId
            };
            
            const response = await fetch('/api/inventory/loadout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loadoutData),
            });
            
            if (!response.ok) {
                throw new Error('Failed to update loadout');
            }
            
            // Update the loadout in state
            setOutfitLoadouts(prev => 
                prev.map(l => l.id === loadout.id ? loadout : l)
            );
            
            return loadout;
        } catch (error) {
            console.error('Error updating outfit loadout:', error);
        }
    }, [address, equippedItems, activeLoadoutId]);

    // Delete a loadout
    const deleteOutfitLoadout = useCallback(async (id: string) => {
        if (!address) return false;
        
        try {
            const isActive = id === activeLoadoutId;
            
            const response = await fetch('/api/inventory/loadout', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: address,
                    loadoutId: id,
                    isActive
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete loadout');
            }
            
            // Remove the loadout from state
            setOutfitLoadouts(prev => prev.filter(loadout => loadout.id !== id));
            
            // If this was the active loadout, clear the active ID
            if (isActive) {
                setActiveLoadoutId(undefined);
            }
            
            return true;
        } catch (error) {
            console.error('Error deleting outfit loadout:', error);
            return false;
        }
    }, [address, activeLoadoutId]);

    // Set a loadout as active and equip all its items
    const setActiveLoadout = useCallback(async (id: string) => {
        if (!address) return false;
        
        try {
            // Find the loadout
            const loadout = outfitLoadouts.find(l => l.id === id);
            if (!loadout) {
                throw new Error('Loadout not found');
            }
            
            // Activate the loadout in the database
            const response = await fetch('/api/inventory/loadout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: address,
                    loadoutId: id,
                    loadoutName: loadout.name,
                    bodyItem: loadout.body,
                    eyesItem: loadout.eyes,
                    furItem: loadout.fur,
                    headItem: loadout.head,
                    minipetItem: loadout.minipet,
                    miscItem: loadout.misc,
                    mouthItem: loadout.mouth,
                    noseItem: loadout.nose,
                    skinItem: loadout.skin,
                    isActive: true
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to activate loadout');
            }
            
            // Set as active in state
            setActiveLoadoutId(id);
            
            // Update outfitLoadouts to reflect the new active loadout
            setOutfitLoadouts(prev => 
                prev.map(l => ({
                    ...l,
                    isActive: l.id === id
                }))
            );
            
            // Equip all items from this loadout
            const equipPromises = [];
            if (loadout.body) equipPromises.push(equipItem(loadout.body, 'body'));
            if (loadout.eyes) equipPromises.push(equipItem(loadout.eyes, 'eyes'));
            if (loadout.fur) equipPromises.push(equipItem(loadout.fur, 'fur'));
            if (loadout.head) equipPromises.push(equipItem(loadout.head, 'head'));
            if (loadout.minipet) equipPromises.push(equipItem(loadout.minipet, 'minipet'));
            if (loadout.misc) equipPromises.push(equipItem(loadout.misc, 'misc'));
            if (loadout.mouth) equipPromises.push(equipItem(loadout.mouth, 'mouth'));
            if (loadout.nose) equipPromises.push(equipItem(loadout.nose, 'nose'));
            if (loadout.skin) equipPromises.push(equipItem(loadout.skin, 'skin'));
            
            await Promise.all(equipPromises);
            
            return true;
        } catch (error) {
            console.error('Error setting active loadout:', error);
            return false;
        }
    }, [address, outfitLoadouts, equipItem]);

    // Add a useEffect to initialize equippedItems from inventoryItems
    useEffect(() => {
        if (inventoryItems.length > 0) {
            const equippedByCategory: { [key in SubCategory]?: string } = {};
            
            inventoryItems.forEach(item => {
                if (item.equipped && item.subCategory) {
                    equippedByCategory[item.subCategory] = item.id;
                }
            });
            
            setEquippedItems(equippedByCategory);
        }
    }, [inventoryItems]);

    // Add a useEffect to fetch loadouts when the address changes
    useEffect(() => {
        const fetchLoadouts = async () => {
            if (!address) return;
            
            try {
                const response = await fetch(`/api/inventory/loadout?walletAddress=${address}`);
                
                if (!response.ok) {
                    throw new Error('Failed to fetch loadouts');
                }
                
                const data = await response.json();
                
                // Transform the data to match frontend format
                const transformedLoadouts: OutfitLoadout[] = data.loadouts.map((loadout: any) => ({
                    id: loadout.loadout_id.toString(),
                    name: loadout.name,
                    body: loadout.body_item,
                    eyes: loadout.eyes_item,
                    fur: loadout.fur_item,
                    head: loadout.head_item,
                    minipet: loadout.minipet_item,
                    misc: loadout.misc_item,
                    mouth: loadout.mouth_item,
                    nose: loadout.nose_item,
                    skin: loadout.skin_item,
                    isActive: loadout.is_active
                }));
                
                setOutfitLoadouts(transformedLoadouts);
                
                // Set active loadout if found
                const activeLoadout = transformedLoadouts.find(l => l.isActive);
                if (activeLoadout) {
                    setActiveLoadoutId(activeLoadout.id);
                }
            } catch (error) {
                console.error('Error fetching loadouts:', error);
            }
        };
        
        fetchLoadouts();
    }, [address]);

    // Fetch inventory items from the database
    useEffect(() => {
        const fetchInventory = async () => {
            if (!address) {
                console.log('No wallet address found, clearing inventory');
                setItems({});
                setInventoryItems([]);
                setIsLoading(false);
                return;
            }

            try {
                console.log('=== INVENTORY FETCH START ===');
                console.log('Fetching inventory for address:', address);
                const normalizedAddress = address.toLowerCase();
                console.log('Normalized address:', normalizedAddress);
                
                const response = await fetch(`/api/inventory/items?walletAddress=${normalizedAddress}`);
                console.log('API Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch inventory: ${response.status}`);
                }

                const data = await response.json();
                console.log('\n=== INVENTORY ITEMS ===');
                if (data.items && data.items.length > 0) {
                    console.log(`Found ${data.items.length} items in inventory:`);
                    data.items.forEach((item: any, index: number) => {
                        console.log(`\nItem ${index + 1}:`);
                        console.log('- ID:', item.id);
                        console.log('- Name:', item.name);
                        console.log('- Category:', item.category);
                        console.log('- Sub-category:', item.sub_category);
                        console.log('- Rarity:', item.rarity);
                        console.log('- Quantity:', item.quantity);
                        console.log('- Equipped:', item.equipped);
                        if (item.color) console.log('- Color:', item.color);
                    });
                } else {
                    console.log('No items found in inventory');
                }

                console.log('\n=== LOADOUTS ===');
                if (data.loadouts && data.loadouts.length > 0) {
                    console.log(`Found ${data.loadouts.length} loadouts:`);
                    data.loadouts.forEach((loadout: any, index: number) => {
                        console.log(`\nLoadout ${index + 1}:`);
                        console.log('- Name:', loadout.name);
                        console.log('- Active:', loadout.is_active);
                    });
                } else {
                    console.log('No loadouts found');
                }

                const newItems: { [key: string]: number } = {};
                data.items.forEach((item: any) => {
                    newItems[item.id] = item.quantity;
                });

                setItems(newItems);
                setInventoryItems(data.items);
                console.log('\n=== INVENTORY FETCH COMPLETE ===\n');
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
        return inventoryItems.filter(item => 
            // Check both camelCase and snake_case versions of the field
            (item.subCategory === category || item.sub_category === category) &&
            // Only include items with quantity > 0
            (item.quantity || 0) > 0
        );
    }, [inventoryItems]);

    const countItem = useCallback((itemId: string): number => {
        return items[itemId] || 0;
    }, [items]);

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

    const updateInventory = (newItems: { [key: string]: number }) => {
        setItems(newItems);
    };

    // Add reloadInventory function
    const reloadInventory = useCallback(async () => {
        if (!address) {
            console.log('No wallet address found, clearing inventory');
            setItems({});
            setInventoryItems([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            console.log('=== INVENTORY FETCH START ===');
            console.log('Fetching inventory for address:', address);
            const normalizedAddress = address.toLowerCase();
            console.log('Normalized address:', normalizedAddress);
            
            const response = await fetch(`/api/inventory/items?walletAddress=${normalizedAddress}`);
            console.log('API Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch inventory: ${response.status}`);
            }

            const data = await response.json();
            console.log('\n=== INVENTORY ITEMS ===');
            if (data.items && data.items.length > 0) {
                console.log(`Found ${data.items.length} items in inventory:`);
                data.items.forEach((item: any, index: number) => {
                    console.log(`\nItem ${index + 1}:`);
                    console.log('- ID:', item.id);
                    console.log('- Name:', item.name);
                    console.log('- Category:', item.category);
                    console.log('- Sub-category:', item.sub_category);
                    console.log('- Rarity:', item.rarity);
                    console.log('- Quantity:', item.quantity);
                    console.log('- Equipped:', item.equipped);
                    if (item.color) console.log('- Color:', item.color);
                });
            } else {
                console.log('No items found in inventory');
            }

            const newItems: { [key: string]: number } = {};
            data.items.forEach((item: any) => {
                newItems[item.id] = item.quantity;
            });

            setItems(newItems);
            setInventoryItems(data.items);
            console.log('\n=== INVENTORY FETCH COMPLETE ===\n');
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    // Update the value object to include the new function
    const value: InventoryContextType = {
        items,
        itemCounts,
        outfitLoadouts,
        activeLoadoutId,
        equippedPowerups,
        equippedItems,
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
        isLoading,
        updateInventory,
        equipItem,
        reloadInventory,
    };

    return (
        <InventoryContext.Provider value={value}>
            {children}
        </InventoryContext.Provider>
    );
}; 