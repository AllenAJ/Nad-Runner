import { Category, Item, SubCategory } from '../types/inventory';
import { ItemManager } from './ItemManager';
import { PayVault } from './PayVault';

export class Shop {
    private itemManager: ItemManager;
    private payVault: PayVault;
    private featuredItems: string[] = [];
    private discountedItems: Map<string, number> = new Map(); // itemId -> discount percentage

    constructor(itemManager: ItemManager, payVault: PayVault) {
        this.itemManager = itemManager;
        this.payVault = payVault;
        this.updateFeaturedItems();
    }

    public getAvailableItems(): Item[] {
        return this.itemManager.getAllItems();
    }

    public getItemsByCategory(category: Category): Item[] {
        return this.itemManager.getItemsByCategory(category);
    }

    public getItemsBySubCategory(category: Category, subCategory: SubCategory): Item[] {
        return this.itemManager.getItemsBySubCategory(category, subCategory);
    }

    public getFeaturedItems(): Item[] {
        return this.featuredItems
            .map(id => this.itemManager.getItem(id))
            .filter((item): item is Item => item !== undefined);
    }

    public getDiscountedItems(): Map<Item, number> {
        const discountedItems = new Map<Item, number>();
        this.discountedItems.forEach((discount, itemId) => {
            const item = this.itemManager.getItem(itemId);
            if (item) {
                discountedItems.set(item, discount);
            }
        });
        return discountedItems;
    }

    public getItemPrice(itemId: string): number {
        const item = this.itemManager.getItem(itemId);
        if (!item) {
            throw new Error(`Item with id ${itemId} not found`);
        }

        const discount = this.discountedItems.get(itemId) || 0;
        return Math.floor(item.price * (1 - discount / 100));
    }

    public purchaseItem(itemId: string): void {
        const item = this.itemManager.getItem(itemId);
        if (!item) {
            throw new Error(`Item with id ${itemId} not found`);
        }

        const price = this.getItemPrice(itemId);
        if (!this.payVault.canAfford(price)) {
            throw new Error(`Insufficient funds to purchase ${item.name}`);
        }

        this.payVault.deductFunds(price);
    }

    public setDiscount(itemId: string, discountPercentage: number): void {
        if (discountPercentage < 0 || discountPercentage > 100) {
            throw new Error('Discount percentage must be between 0 and 100');
        }

        const item = this.itemManager.getItem(itemId);
        if (!item) {
            throw new Error(`Item with id ${itemId} not found`);
        }

        if (discountPercentage === 0) {
            this.discountedItems.delete(itemId);
        } else {
            this.discountedItems.set(itemId, discountPercentage);
        }
    }

    public clearDiscounts(): void {
        this.discountedItems.clear();
    }

    private updateFeaturedItems(): void {
        // Get all available items
        const items = this.itemManager.getAllItems();
        
        // Randomly select up to 4 items to feature
        this.featuredItems = items
            .sort(() => Math.random() - 0.5)
            .slice(0, 4)
            .map(item => item.id);
    }

    public refreshFeaturedItems(): void {
        this.updateFeaturedItems();
    }

    public searchItems(query: string): Item[] {
        return this.itemManager.searchItems(query);
    }
} 