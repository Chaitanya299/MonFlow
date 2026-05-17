import { ProcessedTransaction, DailySummary, TransactionCategory } from './types';

export interface AccountingRepository {
  save(tx: ProcessedTransaction): Promise<void>;
  getById(id: string): Promise<ProcessedTransaction | null>;
  getByDateRange(startMs: number, endMs: number): Promise<ProcessedTransaction[]>;
  getByCategory(category: TransactionCategory): Promise<ProcessedTransaction[]>;
  getUntagged(): Promise<ProcessedTransaction[]>;
  getDailySummary(date: string): Promise<DailySummary>;
  markAsSplit(txId: string, splitGroupId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
