import { Item } from '../types/inventory';

export class PayVault {
    private balance: number;
    private transactions: Transaction[];

    constructor(initialBalance: number = 0) {
        this.balance = initialBalance;
        this.transactions = [];
    }

    public getBalance(): number {
        return this.balance;
    }

    public addFunds(amount: number): void {
        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }
        this.balance += amount;
        this.recordTransaction({
            type: 'credit',
            amount,
            timestamp: new Date(),
            description: 'Added funds'
        });
    }

    public deductFunds(amount: number): void {
        if (amount <= 0) {
            throw new Error('Amount must be positive');
        }
        if (amount > this.balance) {
            throw new Error('Insufficient funds');
        }
        this.balance -= amount;
        this.recordTransaction({
            type: 'debit',
            amount,
            timestamp: new Date(),
            description: 'Deducted funds'
        });
    }

    public canAfford(amount: number): boolean {
        return this.balance >= amount;
    }

    public purchaseItem(item: Item): void {
        if (!this.canAfford(item.price)) {
            throw new Error(`Insufficient funds to purchase ${item.name}`);
        }
        this.deductFunds(item.price);
        this.recordTransaction({
            type: 'purchase',
            amount: item.price,
            timestamp: new Date(),
            description: `Purchased ${item.name}`,
            itemId: item.id
        });
    }

    public refundItem(item: Item): void {
        const refundAmount = Math.floor(item.price * 0.8); // 80% refund
        this.addFunds(refundAmount);
        this.recordTransaction({
            type: 'refund',
            amount: refundAmount,
            timestamp: new Date(),
            description: `Refunded ${item.name}`,
            itemId: item.id
        });
    }

    public getTransactionHistory(): Transaction[] {
        return [...this.transactions];
    }

    private recordTransaction(transaction: Transaction): void {
        this.transactions.push(transaction);
        // Keep only last 100 transactions
        if (this.transactions.length > 100) {
            this.transactions.shift();
        }
    }
}

interface Transaction {
    type: 'credit' | 'debit' | 'purchase' | 'refund';
    amount: number;
    timestamp: Date;
    description: string;
    itemId?: string;
} 