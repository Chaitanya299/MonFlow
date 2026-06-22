import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: {
      getRules: () => [],
      saveRules: () => {},
    },
  },
}));

import { UniversalParser } from '../../../src/domain/tracking/UniversalParser';
import { Deduplicator } from '../../../src/domain/tracking/Deduplicator';
import { TelemetryReporter } from '../../../src/domain/tracking/TelemetryReporter';

describe('UniversalParser', () => {
  beforeEach(() => {
    // Reset caches and metrics before each test
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  describe('parse — real UPI notifications', () => {
    it('should parse GPay "Paid" notification', () => {
      const result = UniversalParser.parse('Paid ₹500 to Rahul via Google Pay');
      expect(result?.amountPaise).toBe(50000);
      expect(result?.currency).toBe('INR');
    });

    it('should parse PhonePe "Sent" notification', () => {
      const result = UniversalParser.parse('₹250.00 sent to Priya on PhonePe');
      expect(result?.amountPaise).toBe(25000);
      expect(result?.currency).toBe('INR');
    });

    it('should parse Paytm debit notification', () => {
      const result = UniversalParser.parse('₹1,200 debited from Paytm Wallet');
      expect(result?.amountPaise).toBe(120000);
    });

    it('should parse "received" notification', () => {
      const result = UniversalParser.parse('₹3,000.00 received from Arun');
      expect(result?.amountPaise).toBe(-300000);
    });

    it('should parse bank-style debit alert', () => {
      const result = UniversalParser.parse('A/C *1234 debited ₹999.99 on 14-May');
      expect(result?.amountPaise).toBe(99999);
    });
  });

  describe('parse — package-specific notifications', () => {
    const GPAY_PACKAGE = 'com.google.android.apps.nbu.paisa.user';
    const PHONEPE_PACKAGE = 'com.phonepe.app';
    const PAYTM_PACKAGE = 'net.one97.paytm';

    it('should parse Google Pay debit notification', () => {
      const result = UniversalParser.parse('You paid ₹150.00 to Chai Tapri', GPAY_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(15000);
      expect(result?.trustLevel).toBe('VERIFIED');
    });

    it('should parse Google Pay credit notification', () => {
      const result = UniversalParser.parse('You received ₹100.00 from Amit', GPAY_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(-10000);
    });

    it('should parse PhonePe standard debit', () => {
      const result = UniversalParser.parse('Paid ₹250 to Grocery Store', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(25000);
    });

    it('should parse PhonePe debit with sent amount first', () => {
      const result = UniversalParser.parse('₹250.00 sent to Priya on PhonePe', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(25000);
    });

    it('should parse PhonePe UPI Lite debit', () => {
      const result = UniversalParser.parse('UPI LITE: Paid ₹20 to Tea Stall', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(2000);
    });

    it('should parse PhonePe credit', () => {
      const result = UniversalParser.parse('Received ₹500 from Dad', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(-50000);
    });

    it('should parse Paytm Wallet debit', () => {
      const result = UniversalParser.parse('Paid ₹50 successfully to Auto Driver from Paytm Wallet', PAYTM_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(5000);
    });

    it('should parse Paytm Wallet debit alternative text', () => {
      const result = UniversalParser.parse('₹1,200 debited from Paytm Wallet', PAYTM_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(120000);
    });

    it('should parse Paytm UPI Lite debit', () => {
      const result = UniversalParser.parse('UPI Lite: Paid ₹30 successfully to shop from Paytm UPI Lite', PAYTM_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(3000);
    });

    it('should parse Paytm Wallet credit', () => {
      const result = UniversalParser.parse('Received ₹100 from Mom into Paytm Wallet', PAYTM_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(-10000);
    });

    it('should parse Paytm Wallet credit alternative text', () => {
      const result = UniversalParser.parse('₹100 credited to your Paytm Wallet', PAYTM_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(-10000);
    });
  });

  describe('parse — decimal precision (paise)', () => {
    it('should handle ₹500.50 → 50050 paise', () => {
      const result = UniversalParser.parse('Spent ₹500.50 on lunch');
      expect(result?.amountPaise).toBe(50050);
    });

    it('should handle ₹0.01 → 1 paisa', () => {
      const result = UniversalParser.parse('₹0.01 debited');
      expect(result?.amountPaise).toBe(1);
    });

    it('should handle ₹100.99 → 10099 paise', () => {
      const result = UniversalParser.parse('₹100.99 paid');
      expect(result?.amountPaise).toBe(10099);
    });
  });

  describe('parse — Structured Trust Scores & Transaction Lifecycles', () => {
    const GPAY_PACKAGE = 'com.google.android.apps.nbu.paisa.user';

    it('should map trust scores and success status based on source package', () => {
      const result = UniversalParser.parse('You paid ₹150 to Swiggy', GPAY_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.events[0].trustScore).toBe('VERY_HIGH');
      expect(result?.events[0].status).toBe('success');
      expect(result?.events[0].tier).toBe(2);
      expect(result?.events[0].parserVersion).toBe('3.0.0');
    });

    it('should assign HIGH trust score to verified bank SMS alerts', () => {
      const result = UniversalParser.parse('A/C *1234 debited ₹250 on 14-May', 'sms:VM-HDFCBK-T');
      expect(result).not.toBeNull();
      expect(result?.events[0].trustScore).toBe('HIGH');
      expect(result?.events[0].status).toBe('success');
      expect(result?.events[0].tier).toBe(3);
    });

    it('should map reversal status for transaction refunds/reversals', () => {
      const result = UniversalParser.parse('Reversal of ₹500.00 credited back', 'sms:VM-HDFCBK-T');
      expect(result).not.toBeNull();
      expect(result?.events[0].status).toBe('reversal');
      expect(result?.events[0].type).toBe('credit');
      expect(result?.events[0].amountPaise).toBe(-50000);
    });
  });

  describe('parse — Template Specificity Precedence Engine', () => {
    const GPAY_PACKAGE = 'com.google.android.apps.nbu.paisa.user';

    it('should resolve matches using the most specific template first', () => {
      // "you paid ₹{amount} to {merchant}" is more specific than "you paid ₹{amount}"
      // This prevents the short template from stealing the match.
      const result = UniversalParser.parse('You paid ₹150 to Swiggy', GPAY_PACKAGE);
      expect(result?.templateId).toBe('gpay_paid');
      expect(result?.events[0].merchantName).toBe('Swiggy');
    });

    it('should fall back to short templates when merchant is missing', () => {
      const result = UniversalParser.parse('You paid ₹150', GPAY_PACKAGE);
      expect(result?.templateId).toBe('gpay_paid_short');
      expect(result?.events[0].merchantName).toBeNull();
    });
  });

  describe('parse — Observability & Telemetry Hooks', () => {
    it('should record template hits and parse counts in local telemetry', () => {
      expect(TelemetryReporter.getMetrics().totalScanned).toBe(0);

      UniversalParser.parse('You paid ₹150 to Swiggy', 'com.google.android.apps.nbu.paisa.user');
      UniversalParser.parse('Received ₹500 from Dad', 'com.phonepe.app');
      UniversalParser.parse('Anomalous garbage message'); // Fail

      const metrics = TelemetryReporter.getMetrics();
      expect(metrics.totalScanned).toBe(3);
      expect(metrics.totalParsed).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.templateHits['gpay_paid']).toBe(1);
      expect(metrics.templateHits['phonepe_received']).toBe(1);
      expect(metrics.anomalies).toHaveLength(1);
      expect(metrics.anomalies[0].reason).toBe('Failed to extract any financial event');
    });
  });

  describe('parse — Real-World Fintech Edge Cases', () => {
    const PHONEPE_PACKAGE = 'com.phonepe.app';

    it('should successfully scrub emojis in input notifications', () => {
      const result = UniversalParser.parse('UPI LITE: Paid ☕️ ₹45 to Tea Vendor 💸', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(4500);
      expect(result?.events[0].merchantName).toBe('Tea Vendor');
    });

    it('should handle RTL and bidirectional characters gracefully', () => {
      const result = UniversalParser.parse('Sent ‎₹150 to Ramesh', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(15000);
    });

    it('should heal OEM truncation elisions', () => {
      // Re-infers ₹ from 'Rs' or '?'
      const result = UniversalParser.parse('Paid ?30 to auto driver', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(3000);
    });

    it('should parse multi-line notification groupings as a single block', () => {
      const result = UniversalParser.parse('₹150 sent to Ramesh\nUPI Ref: 1234567890\nBalance: ₹500', PHONEPE_PACKAGE);
      expect(result).not.toBeNull();
      expect(result?.amountPaise).toBe(15000);
      expect(result?.events[0].merchantName).toBe('Ramesh');
    });

    it('should parse mixed cashback and payment intent sentences', () => {
      const result = UniversalParser.parse('Paid ₹100 successfully to Swiggy, you won ₹10 cashback!', 'net.one97.paytm');
      expect(result).not.toBeNull();
      expect(result?.events).toHaveLength(2);
      expect(result?.events[0].type).toBe('debit');
      expect(result?.events[0].amountPaise).toBe(10000);
      expect(result?.events[1].type).toBe('cashback');
      expect(result?.events[1].amountPaise).toBe(-1000);
    });
  });

  describe('parse — Weighted Semantic Deduplicator', () => {
    it('should NOT merge similar alerts with different amounts (preventing Levenshtein false merges)', () => {
      const alert1 = 'Paid ₹500 to Swiggy';
      const alert2 = 'Paid ₹600 to Swiggy';

      const res1 = UniversalParser.parse(alert1, 'com.phonepe.app');
      const res2 = UniversalParser.parse(alert2, 'com.phonepe.app');

      expect(res1).not.toBeNull();
      expect(res2).not.toBeNull(); // Should parse successfully, not false-merged!
    });

    it('should merge exact duplicates or slightly varied copies arriving within a 2-minute window', () => {
      const alert1 = 'Dear Customer, A/c XX123 debited for Rs 120.00';
      const alert2 = 'Dear Customer, A/C XX123 debited for Rs 120.00'; // casing variation

      const res1 = UniversalParser.parse(alert1, 'sms:VM-HDFCBK-T');
      const res2 = UniversalParser.parse(alert2, 'sms:VM-HDFCBK-T');

      expect(res1).not.toBeNull();
      expect(res2).toBeNull(); // Deduplicated successfully!
    });
  });
});
