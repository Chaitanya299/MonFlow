import { describe, it, expect } from 'vitest';
import type { ProcessedTransaction, TransactionCategory, DailySummary } from '../../../src/domain/accounting/types';
import type { AccountingRepository } from '../../../src/domain/accounting/AccountingRepository';

describe('Accounting Domain — ProcessedTransaction contract', () => {
  const makeTx = (overrides?: Partial<ProcessedTransaction>): ProcessedTransaction => ({
    id: 'tx-001',
    amountPaise: 50000,
    currency: 'INR',
    merchantName: 'Swiggy',
    category: 'food',
    tags: ['lunch'],
    sourcePackage: 'com.google.pay',
    rawText: 'Paid ₹500 to Swiggy',
    timestamp: Date.now(),
    isSplit: false,
    splitGroupId: null,
    ...overrides,
  });

  it('should construct a valid ProcessedTransaction with all required fields', () => {
    const tx = makeTx();
    expect(tx.id).toBe('tx-001');
    expect(tx.amountPaise).toBe(50000);
    expect(tx.currency).toBe('INR');
    expect(tx.merchantName).toBe('Swiggy');
    expect(tx.category).toBe('food');
    expect(tx.tags).toEqual(['lunch']);
    expect(tx.sourcePackage).toBe('com.google.pay');
    expect(tx.isSplit).toBe(false);
    expect(tx.splitGroupId).toBeNull();
  });

  it('should allow null merchantName for peer-to-peer transfers', () => {
    const tx = makeTx({ merchantName: null, category: 'transfer' });
    expect(tx.merchantName).toBeNull();
  });

  it('should use integer paise — never fractional amounts', () => {
    const tx = makeTx({ amountPaise: 10099 });
    expect(Number.isInteger(tx.amountPaise)).toBe(true);
  });

  it('should default isSplit to false, splitGroupId to null', () => {
    const tx = makeTx();
    expect(tx.isSplit).toBe(false);
    expect(tx.splitGroupId).toBeNull();
  });

  it('should link to a split group when marked as split', () => {
    const tx = makeTx({ isSplit: true, splitGroupId: 'grp-abc' });
    expect(tx.isSplit).toBe(true);
    expect(tx.splitGroupId).toBe('grp-abc');
  });

  it('should support empty tags array', () => {
    const tx = makeTx({ tags: [] });
    expect(tx.tags).toEqual([]);
  });

  it('should support multiple tags', () => {
    const tx = makeTx({ tags: ['food', 'office', 'team-lunch'] });
    expect(tx.tags).toHaveLength(3);
  });
});

describe('Accounting Domain — TransactionCategory contract', () => {
  const validCategories: TransactionCategory[] = [
    'food', 'transport', 'shopping', 'bills',
    'entertainment', 'health', 'transfer', 'untagged',
  ];

  it('should have exactly 8 valid categories', () => {
    expect(validCategories).toHaveLength(8);
  });

  it.each(validCategories)('category "%s" should be assignable to ProcessedTransaction', (cat) => {
    const tx: ProcessedTransaction = {
      id: 'test',
      amountPaise: 100,
      currency: 'INR',
      merchantName: null,
      category: cat,
      tags: [],
      sourcePackage: 'test',
      rawText: 'test',
      timestamp: 0,
      isSplit: false,
      splitGroupId: null,
    };
    expect(tx.category).toBe(cat);
  });
});

describe('Accounting Domain — DailySummary contract', () => {
  const makeSummary = (overrides?: Partial<DailySummary>): DailySummary => ({
    date: '2026-05-14',
    totalSpentPaise: 150000,
    totalReceivedPaise: 50000,
    transactionCount: 5,
    byCategory: {
      food: 80000,
      transport: 20000,
      shopping: 50000,
      bills: 0,
      entertainment: 0,
      health: 0,
      transfer: 0,
      untagged: 0,
    },
    ...overrides,
  });

  it('should construct a valid DailySummary', () => {
    const s = makeSummary();
    expect(s.date).toBe('2026-05-14');
    expect(s.totalSpentPaise).toBe(150000);
    expect(s.totalReceivedPaise).toBe(50000);
    expect(s.transactionCount).toBe(5);
  });

  it('should have all 8 categories in byCategory', () => {
    const s = makeSummary();
    const keys = Object.keys(s.byCategory);
    expect(keys).toHaveLength(8);
    expect(keys).toContain('food');
    expect(keys).toContain('untagged');
  });

  it('should use integer paise in byCategory totals', () => {
    const s = makeSummary();
    Object.values(s.byCategory).forEach(val => {
      expect(Number.isInteger(val)).toBe(true);
    });
  });

  it('should allow zero-transaction days', () => {
    const s = makeSummary({
      totalSpentPaise: 0,
      totalReceivedPaise: 0,
      transactionCount: 0,
    });
    expect(s.transactionCount).toBe(0);
  });
});

describe('Accounting Domain — AccountingRepository interface', () => {
  it('should define all required repository methods', () => {
    const repoShape: Record<keyof AccountingRepository, string> = {
      save: 'function',
      getById: 'function',
      getByDateRange: 'function',
      getByCategory: 'function',
      getUntagged: 'function',
      getDailySummary: 'function',
      markAsSplit: 'function',
      delete: 'function',
    };
    expect(Object.keys(repoShape)).toHaveLength(8);
  });
});
