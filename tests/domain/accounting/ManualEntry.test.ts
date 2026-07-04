import { describe, it, expect } from 'vitest';
import { toPaise, buildManualTransaction, computeCashWallet } from '../../../src/domain/accounting/ManualEntry';
import { ProcessedTransaction } from '../../../src/domain/accounting/types';

describe('toPaise validation', () => {
  it('converts rupees to integer paise', () => {
    expect(toPaise('500')).toBe(50000);
    expect(toPaise('12.5')).toBe(1250);
    expect(toPaise(99.99)).toBe(9999);
  });

  it('rejects invalid / non-positive / overflow amounts', () => {
    for (const bad of ['', 'abc', '0', '-5', 'NaN', Infinity, '9999999999']) {
      expect(() => toPaise(bad as any)).toThrow();
    }
  });
});

describe('buildManualTransaction sign convention', () => {
  it('spend is positive paise, income is negative', () => {
    const spend = buildManualTransaction({ amountRupees: '100', direction: 'out', category: 'food', sourcePackage: 'cash' });
    const topup = buildManualTransaction({ amountRupees: '100', direction: 'in', category: 'transfer', sourcePackage: 'cash' });
    expect(spend.amountPaise).toBe(10000);
    expect(topup.amountPaise).toBe(-10000);
    expect(spend.sourcePackage).toBe('cash');
    expect(spend.trustLevel).toBe('VERIFIED');
  });
});

describe('computeCashWallet', () => {
  const mk = (amountPaise: number, timestamp: number): ProcessedTransaction => ({
    id: 'x', amountPaise, currency: 'INR', merchantName: null, category: 'untagged',
    tags: [], sourcePackage: 'cash', rawText: '', timestamp, isSplit: false,
    splitGroupId: null, trustLevel: 'VERIFIED',
  });

  it('balance = top-ups minus spends; today spend counts only today', () => {
    const now = new Date('2026-07-04T10:00:00').getTime();
    const yesterday = new Date('2026-07-03T10:00:00').getTime();
    const wallet = computeCashWallet([
      mk(-200000, now),      // +₹2000 top-up
      mk(50000, now),        // -₹500 spend today
      mk(30000, yesterday),  // -₹300 spend yesterday
    ], now);
    expect(wallet.balancePaise).toBe(120000);   // 2000 - 500 - 300 = ₹1200
    expect(wallet.todaySpentPaise).toBe(50000); // only today's ₹500
  });

  it('empty wallet is zero', () => {
    expect(computeCashWallet([])).toEqual({ balancePaise: 0, todaySpentPaise: 0 });
  });
});
