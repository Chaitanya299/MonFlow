import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: {
      getPendingAlerts: vi.fn(),
      clearProcessedAlerts: vi.fn(),
      saveTransaction: vi.fn(),
    },
  },
}));

import { NativeModules } from 'react-native';
import { runHandshake } from '../../../src/domain/tracking/AlertHandshake';

const mockBridge = NativeModules.MonfloBridge as {
  getPendingAlerts: ReturnType<typeof vi.fn>;
  clearProcessedAlerts: ReturnType<typeof vi.fn>;
  saveTransaction: ReturnType<typeof vi.fn>;
};

const GPAY = 'com.google.android.apps.nbu.paisa.user';

describe('AlertHandshake — runHandshake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should fetch alerts from native bridge', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([]);
    await runHandshake();
    expect(mockBridge.getPendingAlerts).toHaveBeenCalledOnce();
  });

  it('should parse valid transaction and log it', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 1, rawText: 'Paid ₹500 to Rahul', packageName: 'com.google.pay', timestamp: Date.now() },
    ]);
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);

    await runHandshake();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Parsed transaction: 50000 INR'));
  });

  it('should clear all processed alert IDs after parsing', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 1, rawText: 'Paid ₹500 to Rahul', packageName: 'com.google.pay', timestamp: Date.now() },
      { id: 2, rawText: '₹200 received from Priya', packageName: 'com.phonepe', timestamp: Date.now() },
    ]);
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);

    await runHandshake();

    expect(mockBridge.clearProcessedAlerts).toHaveBeenCalledWith([1, 2]);
  });

  it('should filter out promotional alerts (not parse them)', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 1, rawText: 'Special offer: Get 50% discount on orders using code PROMO1!', packageName: 'com.paytm', timestamp: Date.now() },
    ]);
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);

    await runHandshake();

    expect(console.log).not.toHaveBeenCalled();
    expect(mockBridge.clearProcessedAlerts).toHaveBeenCalledWith([1]);
  });

  it('should still clear IDs for promotional alerts', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 10, rawText: 'Get 20% discount! Use code SAVE20', packageName: 'com.paytm', timestamp: Date.now() },
    ]);
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);

    await runHandshake();

    expect(mockBridge.clearProcessedAlerts).toHaveBeenCalledWith([10]);
  });

  it('should skip clearProcessedAlerts when alerts list is empty', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([]);
    await runHandshake();
    expect(mockBridge.clearProcessedAlerts).not.toHaveBeenCalled();
  });

  it('should skip clearProcessedAlerts when alerts is null', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue(null);
    await runHandshake();
    expect(mockBridge.clearProcessedAlerts).not.toHaveBeenCalled();
  });

  it('should catch and log errors from native bridge', async () => {
    mockBridge.getPendingAlerts.mockRejectedValue(new Error('Bridge disconnected'));
    await runHandshake();
    expect(console.error).toHaveBeenCalledWith('Handshake failed:', expect.any(Error));
  });

  it('should handle mixed valid + promotional + unparseable alerts', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 1, rawText: 'Paid ₹100 to Amit', packageName: 'com.google.pay', timestamp: Date.now() },
      { id: 2, rawText: 'Win ₹5000 now!', packageName: 'com.spam', timestamp: Date.now() },
      { id: 3, rawText: 'Random text no amount', packageName: 'com.unknown', timestamp: Date.now() },
    ]);
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);

    await runHandshake();

    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Parsed transaction: 10000 INR'));
    // Two saves: the parsed transaction + the unparseable alert kept as raw untagged
    expect(mockBridge.saveTransaction).toHaveBeenCalledTimes(2);
    expect(mockBridge.clearProcessedAlerts).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('should save unparseable non-promotional alerts as raw untagged entries', async () => {
    const rawText = 'Your relationship manager for account XX99 has changed';
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 7, rawText, packageName: 'sms:VM-HDFCBK-S', timestamp: 1234 },
    ]);
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);

    await runHandshake();

    expect(mockBridge.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'untagged',
        amountPaise: 0,
        rawText,
        tags: ['unparsed'],
        sourcePackage: 'sms:VM-HDFCBK-S',
      })
    );
    expect(mockBridge.clearProcessedAlerts).toHaveBeenCalledWith([7]);
  });
});

describe('AlertHandshake — auto-categorization (end to end)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockBridge.clearProcessedAlerts.mockResolvedValue(undefined);
    mockBridge.saveTransaction.mockResolvedValue(undefined);
  });

  it('extracts the merchant and auto-categorizes a food payment', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 1, rawText: 'You paid ₹500 to Zomato', packageName: GPAY, timestamp: 1000 },
    ]);

    await runHandshake();

    expect(mockBridge.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ merchantName: 'Zomato', category: 'food', amountPaise: 50000 })
    );
  });

  it('folds a travel merchant into transport', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 2, rawText: 'You paid ₹1200 to MakeMyTrip', packageName: GPAY, timestamp: 2000 },
    ]);

    await runHandshake();

    expect(mockBridge.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ merchantName: 'MakeMyTrip', category: 'transport' })
    );
  });

  it('leaves an unknown merchant untagged for manual reconciliation', async () => {
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 3, rawText: 'You paid ₹100 to Rahul Kumar', packageName: GPAY, timestamp: 3000 },
    ]);

    await runHandshake();

    expect(mockBridge.saveTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ merchantName: 'Rahul Kumar', category: 'untagged' })
    );
  });
});

describe('AlertHandshake — bridge unavailable', () => {
  it('should warn and return early when MonfloBridge is null', async () => {
    const origBridge = NativeModules.MonfloBridge;
    (NativeModules as any).MonfloBridge = null;

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { runHandshake: freshHandshake } = await import('../../../src/domain/tracking/AlertHandshake');

    (NativeModules as any).MonfloBridge = origBridge;
  });
});
