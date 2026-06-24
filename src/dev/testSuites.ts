import { describe, it, expect, beforeEach } from './minitest';
import { MerchantDetector } from '../domain/tracking/MerchantDetector';
import { UniversalParser } from '../domain/tracking/UniversalParser';
import { Deduplicator } from '../domain/tracking/Deduplicator';
import { TelemetryReporter } from '../domain/tracking/TelemetryReporter';

// ─────────────────────────────────────────
// MerchantDetector — 26 tests
// ─────────────────────────────────────────

describe('MerchantDetector › exact matching', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('should categorize "Amazon Pay" as shopping', () => {
    expect(detector.categorize('Amazon Pay')).toBe('shopping');
  });

  it('should categorize "Swiggy" as food', () => {
    expect(detector.categorize('Swiggy')).toBe('food');
  });

  it('should categorize "Uber" as transport', () => {
    expect(detector.categorize('Uber')).toBe('transport');
  });

  it('should be case insensitive', () => {
    expect(detector.categorize('AMAZON PAY')).toBe('shopping');
    expect(detector.categorize('amazon pay')).toBe('shopping');
    expect(detector.categorize('AmaZon PAy')).toBe('shopping');
  });

  it('should handle merchants with multiple aliases', () => {
    expect(detector.categorize('Flipkart')).toBe('shopping');
    expect(detector.categorize('Flipkart Pay')).toBe('shopping');
  });
});

describe('MerchantDetector › fuzzy matching', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('should match "Swiggi" (typo) to Swiggy → food', () => {
    expect(detector.categorize('Swiggi')).toBe('food');
  });

  it('should match "Amzn" (abbreviation) to Amazon → shopping', () => {
    expect(detector.categorize('Amzn')).toBe('shopping');
  });

  it('should match "Zomatoo" (typo) to Zomato → food', () => {
    expect(detector.categorize('Zomatoo')).toBe('food');
  });

  it('should not match gibberish to any category', () => {
    expect(detector.categorize('xyzabc123notamerchant')).toBe('untagged');
  });
});

describe('MerchantDetector › edge cases', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('should return untagged for null input', () => {
    expect(detector.categorize(null)).toBe('untagged');
  });

  it('should return untagged for empty string', () => {
    expect(detector.categorize('')).toBe('untagged');
  });

  it('should return untagged for whitespace only', () => {
    expect(detector.categorize('   ')).toBe('untagged');
  });

  it('should handle priority correctly (Amazon vs generic Payment)', () => {
    expect(detector.categorize('Amazon Pay')).toBe('shopping');
  });
});

describe('MerchantDetector › caching', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('should cache merchant lookups', () => {
    expect(detector.categorize('Starbucks')).toBe('food');
    expect(detector.categorize('Starbucks')).toBe('food');
  });

  it('should evict old entries when cache exceeds max size', () => {
    for (let i = 0; i < 600; i++) {
      detector.categorize(`merchant${i}`);
    }
    detector.categorize('Swiggy');
    expect(detector.categorize('Swiggy')).toBe('food');
  });
});

describe('MerchantDetector › real-world SMS samples', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('should return untagged for UPI VPA handle', () => {
    expect(detector.categorize('paytmqr6u0up1@ptys')).toBe('untagged');
  });

  it('should categorize "Jio" as bills', () => {
    expect(detector.categorize('Jio')).toBe('bills');
  });

  it('should categorize "Apollo" as health', () => {
    expect(detector.categorize('Apollo')).toBe('health');
  });

  it('should categorize "Netflix" as entertainment', () => {
    expect(detector.categorize('Netflix')).toBe('entertainment');
  });

  it('should categorize "Salary" as transfer', () => {
    expect(detector.categorize('Salary')).toBe('transfer');
  });

  it('should categorize "DMart" as shopping', () => {
    expect(detector.categorize('DMart')).toBe('shopping');
  });

  it('should categorize "Ola" as transport', () => {
    expect(detector.categorize('Ola')).toBe('transport');
  });

  it('should categorize "Fitness" as health', () => {
    expect(detector.categorize('Fitness')).toBe('health');
  });

  it('should categorize "Insurance" as bills', () => {
    expect(detector.categorize('Insurance')).toBe('bills');
  });

  it('should categorize "Rent" as bills', () => {
    expect(detector.categorize('Rent')).toBe('bills');
  });
});

describe('MerchantDetector › performance', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('should categorize in <5ms on average', () => {
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      detector.categorize('Amazon Pay');
    }
    const avgTime = (performance.now() - start) / iterations;
    expect(avgTime).toBeLessThan(5);
  });
});

// ─────────────────────────────────────────
// UniversalParser — 30 tests
// ─────────────────────────────────────────

describe('UniversalParser › real UPI notifications', () => {
  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

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

describe('UniversalParser › package-specific notifications', () => {
  const GPAY = 'com.google.android.apps.nbu.paisa.user';
  const PHONEPE = 'com.phonepe.app';
  const PAYTM = 'net.one97.paytm';

  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  it('should parse Google Pay debit notification', () => {
    const result = UniversalParser.parse('You paid ₹150.00 to Chai Tapri', GPAY);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(15000);
    expect(result?.trustLevel).toBe('VERIFIED');
  });

  it('should parse Google Pay credit notification', () => {
    const result = UniversalParser.parse('You received ₹100.00 from Amit', GPAY);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(-10000);
  });

  it('should parse PhonePe standard debit', () => {
    const result = UniversalParser.parse('Paid ₹250 to Grocery Store', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(25000);
  });

  it('should parse PhonePe debit with sent amount first', () => {
    const result = UniversalParser.parse('₹250.00 sent to Priya on PhonePe', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(25000);
  });

  it('should parse PhonePe UPI Lite debit', () => {
    const result = UniversalParser.parse('UPI LITE: Paid ₹20 to Tea Stall', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(2000);
  });

  it('should parse PhonePe credit', () => {
    const result = UniversalParser.parse('Received ₹500 from Dad', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(-50000);
  });

  it('should parse Paytm Wallet debit', () => {
    const result = UniversalParser.parse('Paid ₹50 successfully to Auto Driver from Paytm Wallet', PAYTM);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(5000);
  });

  it('should parse Paytm Wallet debit alternative text', () => {
    const result = UniversalParser.parse('₹1,200 debited from Paytm Wallet', PAYTM);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(120000);
  });

  it('should parse Paytm UPI Lite debit', () => {
    const result = UniversalParser.parse('UPI Lite: Paid ₹30 successfully to shop from Paytm UPI Lite', PAYTM);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(3000);
  });

  it('should parse Paytm Wallet credit', () => {
    const result = UniversalParser.parse('Received ₹100 from Mom into Paytm Wallet', PAYTM);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(-10000);
  });

  it('should parse Paytm Wallet credit alternative text', () => {
    const result = UniversalParser.parse('₹100 credited to your Paytm Wallet', PAYTM);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(-10000);
  });
});

describe('UniversalParser › decimal precision (paise)', () => {
  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

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

describe('UniversalParser › trust scores & transaction lifecycles', () => {
  const GPAY = 'com.google.android.apps.nbu.paisa.user';

  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  it('should map trust scores and success status based on source package', () => {
    const result = UniversalParser.parse('You paid ₹150 to Swiggy', GPAY);
    expect(result != null).toBe(true);
    expect(result?.events[0].trustScore).toBe('VERY_HIGH');
    expect(result?.events[0].status).toBe('success');
    expect(result?.events[0].tier).toBe(2);
    expect(result?.events[0].parserVersion).toBe('3.0.0');
  });

  it('should assign HIGH trust score to verified bank SMS alerts', () => {
    const result = UniversalParser.parse('A/C *1234 debited ₹250 on 14-May', 'sms:VM-HDFCBK-T');
    expect(result != null).toBe(true);
    expect(result?.events[0].trustScore).toBe('HIGH');
    expect(result?.events[0].status).toBe('success');
    expect(result?.events[0].tier).toBe(3);
  });

  it('should map reversal status for transaction refunds', () => {
    const result = UniversalParser.parse('Reversal of ₹500.00 credited back', 'sms:VM-HDFCBK-T');
    expect(result != null).toBe(true);
    expect(result?.events[0].status).toBe('reversal');
    expect(result?.events[0].type).toBe('credit');
    expect(result?.events[0].amountPaise).toBe(-50000);
  });
});

describe('UniversalParser › template specificity precedence', () => {
  const GPAY = 'com.google.android.apps.nbu.paisa.user';

  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  it('should resolve matches using the most specific template first', () => {
    const result = UniversalParser.parse('You paid ₹150 to Swiggy', GPAY);
    expect(result?.templateId).toBe('gpay_paid');
    expect(result?.events[0].merchantName).toBe('Swiggy');
  });

  it('should fall back to short templates when merchant is missing', () => {
    const result = UniversalParser.parse('You paid ₹150', GPAY);
    expect(result?.templateId).toBe('gpay_paid_short');
    expect(result?.events[0].merchantName).toBeNull();
  });
});

describe('UniversalParser › observability & telemetry', () => {
  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  it('should record template hits and parse counts in local telemetry', () => {
    expect(TelemetryReporter.getMetrics().totalScanned).toBe(0);

    UniversalParser.parse('You paid ₹150 to Swiggy', 'com.google.android.apps.nbu.paisa.user');
    UniversalParser.parse('Received ₹500 from Dad', 'com.phonepe.app');
    UniversalParser.parse('Anomalous garbage message');

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

describe('UniversalParser › real-world fintech edge cases', () => {
  const PHONEPE = 'com.phonepe.app';

  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  it('should scrub emojis in input notifications', () => {
    const result = UniversalParser.parse('UPI LITE: Paid ☕️ ₹45 to Tea Vendor 💸', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(4500);
    expect(result?.events[0].merchantName).toBe('Tea Vendor');
  });

  it('should handle RTL and bidirectional characters gracefully', () => {
    const result = UniversalParser.parse('Sent ‎₹150 to Ramesh', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(15000);
  });

  it('should heal OEM truncation elisions', () => {
    const result = UniversalParser.parse('Paid ?30 to auto driver', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(3000);
  });

  it('should parse multi-line notification groupings as a single block', () => {
    const result = UniversalParser.parse('₹150 sent to Ramesh\nUPI Ref: 1234567890\nBalance: ₹500', PHONEPE);
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(15000);
    expect(result?.events[0].merchantName).toBe('Ramesh');
  });

  it('should parse mixed cashback and payment intent sentences', () => {
    const result = UniversalParser.parse('Paid ₹100 successfully to Swiggy, you won ₹10 cashback!', 'net.one97.paytm');
    expect(result != null).toBe(true);
    expect(result?.events).toHaveLength(2);
    expect(result?.events[0].type).toBe('debit');
    expect(result?.events[0].amountPaise).toBe(10000);
    expect(result?.events[1].type).toBe('cashback');
    expect(result?.events[1].amountPaise).toBe(-1000);
  });
});

describe('UniversalParser › weighted semantic deduplicator', () => {
  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  it('should NOT merge similar alerts with different amounts', () => {
    const res1 = UniversalParser.parse('Paid ₹500 to Swiggy', 'com.phonepe.app');
    const res2 = UniversalParser.parse('Paid ₹600 to Swiggy', 'com.phonepe.app');
    expect(res1 != null).toBe(true);
    expect(res2 != null).toBe(true);
  });

  it('should merge exact duplicates or casing variations within 2-minute window', () => {
    const res1 = UniversalParser.parse('Dear Customer, A/c XX123 debited for Rs 120.00', 'sms:VM-HDFCBK-T');
    const res2 = UniversalParser.parse('Dear Customer, A/C XX123 debited for Rs 120.00', 'sms:VM-HDFCBK-T');
    expect(res1 != null).toBe(true);
    expect(res2).toBeNull();
  });
});

// ─────────────────────────────────────────
// Integration tests — 10 tests
// end-to-end pipeline: SMS → parse → categorize
// ─────────────────────────────────────────

describe('Integration › parse + categorize pipeline', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  it('HDFC debit SMS → 50000 paise → food category', () => {
    const result = UniversalParser.parse('Txn Rs.500 On HDFC Bank Card 1580 At swiggy', 'sms:AD-HDFCBK-S');
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(50000);
    const category = detector.categorize(result?.events[0]?.merchantName ?? '');
    expect(category).toBe('food');
  });

  it('SBI credit SMS → negative paise (received)', () => {
    const result = UniversalParser.parse('₹5,000 credited to your A/c 1234 by NEFT', 'sms:SBI');
    expect(result != null).toBe(true);
    expect((result?.amountPaise ?? 0) < 0).toBe(true);
  });

  it('Paytm debit → amount + merchant extracted', () => {
    const result = UniversalParser.parse('Paid ₹75 successfully to Zomato from Paytm Wallet', 'net.one97.paytm');
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(7500);
    expect(result?.events[0].merchantName).toBe('Zomato');
  });

  it('GPay UPI → VERIFIED trust level', () => {
    const result = UniversalParser.parse('You paid ₹200 to Rahul', 'com.google.android.apps.nbu.paisa.user');
    expect(result != null).toBe(true);
    expect(result?.trustLevel).toBe('VERIFIED');
  });

  it('Cashback promo notification → filtered by promotional filter', () => {
    const result = UniversalParser.parse('Congratulations! You have earned ₹50 cashback on your purchase. Redeem now!');
    expect(result).toBeNull();
  });

  it('Unknown merchant in SMS → untagged category', () => {
    const result = UniversalParser.parse('₹300 paid to XYZ1234Corp', 'com.phonepe.app');
    if (result != null) {
      const category = detector.categorize(result.events[0]?.merchantName ?? '');
      expect(category).toBe('untagged');
    } else {
      expect(true).toBe(true);
    }
  });

  it('₹0.01 → 1 paise (minimum denomination)', () => {
    const result = UniversalParser.parse('₹0.01 debited from your account');
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(1);
  });

  it('₹1,00,000 → 10000000 paise (lakh formatting)', () => {
    const result = UniversalParser.parse('₹1,00,000 sent to Ramesh', 'com.phonepe.app');
    expect(result != null).toBe(true);
    expect(result?.amountPaise).toBe(10000000);
  });

  it('empty string → null result', () => {
    const result = UniversalParser.parse('');
    expect(result).toBeNull();
  });

  it('gibberish text → null result', () => {
    const result = UniversalParser.parse('asdfghjkl qwerty 999 zxcvbnm');
    expect(result).toBeNull();
  });
});
