import { NativeModules } from 'react-native';
import {
  AccountingRepository,
} from './AccountingRepository';
import {
  ProcessedTransaction,
  DailySummary,
  TransactionCategory
} from './types';

const { MonfloBridge } = NativeModules;

export class NativeAccountingRepository implements AccountingRepository {
  async save(tx: ProcessedTransaction): Promise<void> {
    if (!MonfloBridge) throw new Error('MonfloBridge not available');
    await MonfloBridge.saveTransaction(tx);
  }

  async getById(id: string): Promise<ProcessedTransaction | null> {
    // For now, we use a date range search as a proxy or implement a specific bridge method
    // In a real implementation, we'd add getTransactionById to the bridge.
    const all = await this.getByDateRange(0, Date.now() * 2);
    return all.find(t => t.id === id) || null;
  }

  async getByDateRange(startMs: number, endMs: number): Promise<ProcessedTransaction[]> {
    if (!MonfloBridge) throw new Error('MonfloBridge not available');
    return await MonfloBridge.getTransactionsByDateRange(startMs, endMs);
  }

  async getByCategory(category: TransactionCategory): Promise<ProcessedTransaction[]> {
    const all = await this.getByDateRange(0, Date.now() * 2);
    return all.filter(t => t.category === category);
  }

  async getUntagged(): Promise<ProcessedTransaction[]> {
    return this.getByCategory('untagged');
  }

  async getDailySummary(date: string): Promise<DailySummary> {
    const startOfDay = new Date(date).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    const txs = await this.getByDateRange(startOfDay, endOfDay);

    const summary: DailySummary = {
      date,
      totalSpentPaise: 0,
      totalReceivedPaise: 0,
      transactionCount: txs.length,
      byCategory: {
        food: 0, transport: 0, shopping: 0, bills: 0,
        entertainment: 0, health: 0, transfer: 0, untagged: 0
      }
    };

    txs.forEach(tx => {
      if (tx.amountPaise > 0) {
        summary.totalSpentPaise += tx.amountPaise;
      } else {
        summary.totalReceivedPaise += Math.abs(tx.amountPaise);
      }
      summary.byCategory[tx.category] = (summary.byCategory[tx.category] || 0) + Math.abs(tx.amountPaise);
    });

    return summary;
  }

  async markAsSplit(txId: string, splitGroupId: string): Promise<void> {
    if (!MonfloBridge) throw new Error('MonfloBridge not available');
    await MonfloBridge.updateTransactionCategory(txId, 'transfer'); // Mark as transfer when split
    // In a real app, we'd also update the isSplit flag via a dedicated bridge method
  }

  async updateCategory(txId: string, category: TransactionCategory): Promise<void> {
    if (!MonfloBridge) throw new Error('MonfloBridge not available');
    await MonfloBridge.updateTransactionCategory(txId, category);
  }

  async delete(id: string): Promise<void> {
    // Placeholder - would need bridge method deleteTransaction(id)
    console.warn(`Delete transaction ${id} called - bridge method not yet implemented`);
  }
}
