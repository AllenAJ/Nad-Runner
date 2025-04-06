import { Category, Item, Rarity, SubCategory } from '../types/inventory';
import { INITIAL_ITEMS } from '../constants/inventory';

export class ItemManager {
    private items: Map<string, Item>;

    constructor() {
        this.items = new Map();
        this.initializeItems();
    }

    private initializeItems(): void {
        INITIAL_ITEMS.forEach(item => {
            this.items.set(item.id, item);
        });
    }

    public getItem(id: string): Item | undefined {
        return this.items.get(id);
    }

    public getAllItems(): Item[] {
        return Array.from(this.items.values());
    }

    public getItemsByCategory(category: Category): Item[] {
        return this.getAllItems().filter(item => item.category === category);
    }

    public getItemsBySubCategory(category: Category, subCategory: SubCategory): Item[] {
        return this.getAllItems().filter(
            item => item.category === category && item.subCategory === subCategory
        );
    }

    public getItemsByRarity(rarity: Rarity): Item[] {
        return this.getAllItems().filter(item => item.rarity === rarity);
    }

    public addItem(item: Item): void {
        if (this.items.has(item.id)) {
            throw new Error(`Item with id ${item.id} already exists`);
        }
        this.items.set(item.id, item);
    }

    public removeItem(id: string): boolean {
        return this.items.delete(id);
    }

    public updateItem(item: Item): void {
        if (!this.items.has(item.id)) {
            throw new Error(`Item with id ${item.id} does not exist`);
        }
        this.items.set(item.id, item);
    }

    public searchItems(query: string): Item[] {
        const lowercaseQuery = query.toLowerCase();
        return this.getAllItems().filter(item => 
            item.name.toLowerCase().includes(lowercaseQuery) ||
            item.description.toLowerCase().includes(lowercaseQuery)
        );
    }

    public getItemEffects(id: string): Record<string, number> | undefined {
        const item = this.getItem(id);
        return item?.effects;
    }

    public calculateTotalEffects(itemIds: string[]): Record<string, number> {
        const effects: Record<string, number> = {};
        
        itemIds.forEach(id => {
            const itemEffects = this.getItemEffects(id);
            if (itemEffects) {
                Object.entries(itemEffects).forEach(([effect, value]) => {
                    effects[effect] = (effects[effect] || 1) * value;
                });
            }
        });

        return effects;
    }

    public validateOutfit(head?: string, body?: string, legs?: string, feet?: string): boolean {
        const items = [head, body, legs, feet].filter(Boolean) as string[];
        return items.every(id => {
            const item = this.getItem(id);
            return item && item.category === 'outfits';
        });
    }

    public validatePowerups(powerupIds: string[]): boolean {
        return powerupIds.every(id => {
            const item = this.getItem(id);
            return item && item.category === 'powerups';
        });
    }
} 