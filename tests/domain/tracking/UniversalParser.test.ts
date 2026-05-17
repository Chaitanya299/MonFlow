import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: {
      getRules: () => [],
      saveRules: () => {},
    },
  },
}));

import { UniversalParser } from '../../../src/domain/tracking/UniversalParser';

describe('UniversalParser', () => {
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

  describe('parse — Indian comma notation (lakhs/crores)', () => {
    it('should parse ₹1,50,000 (1.5 lakh)', () => {
      const result = UniversalParser.parse('Paid ₹1,50,000 to Dealer');
      expect(result?.amountPaise).toBe(15000000);
    });

    it('should parse ₹10,00,000 (10 lakh)', () => {
      const result = UniversalParser.parse('₹10,00,000 credited');
      expect(result?.amountPaise).toBe(-100000000);
    });

    it('should parse ₹1,00,00,000 (1 crore)', () => {
      const result = UniversalParser.parse('₹1,00,00,000 transferred');
      expect(result?.amountPaise).toBe(1000000000);
    });

    it('should parse ₹99,999 (below lakh threshold)', () => {
      const result = UniversalParser.parse('₹99,999 spent');
      expect(result?.amountPaise).toBe(9999900);
    });

    it('should parse lakhs with decimals ₹1,50,000.75', () => {
      const result = UniversalParser.parse('₹1,50,000.75 debited');
      expect(result?.amountPaise).toBe(15000075);
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

    it('should handle ₹0.10 → 10 paise', () => {
      const result = UniversalParser.parse('₹0.10 sent');
      expect(result?.amountPaise).toBe(10);
    });

    it('should handle ₹100.99 → 10099 paise', () => {
      const result = UniversalParser.parse('₹100.99 paid');
      expect(result?.amountPaise).toBe(10099);
    });

    it('should avoid float errors: ₹33.33 → exactly 3333 paise', () => {
      const result = UniversalParser.parse('₹33.33 debited');
      expect(result?.amountPaise).toBe(3333);
    });

    it('should avoid float errors: ₹19.99 → exactly 1999 paise', () => {
      const result = UniversalParser.parse('₹19.99 spent');
      expect(result?.amountPaise).toBe(1999);
    });
  });

  describe('parse — negative amounts (refunds)', () => {
    it('should parse -₹500.00 as negative paise', () => {
      const result = UniversalParser.parse('Refunded -₹500.00');
      expect(result?.amountPaise).toBe(-50000);
    });

    it('should parse -₹1,200 with comma', () => {
      const result = UniversalParser.parse('Reversal -₹1,200 credited');
      expect(result?.amountPaise).toBe(-120000);
    });
  });

  describe('parse — edge cases', () => {
    it('should return null for empty string', () => {
      expect(UniversalParser.parse('')).toBeNull();
    });

    it('should return null when no currency symbol present', () => {
      expect(UniversalParser.parse('Paid 500 to Rahul')).toBeNull();
    });

    it('should return null for random text', () => {
      expect(UniversalParser.parse('Hello world')).toBeNull();
    });

    it('should return null for only whitespace', () => {
      expect(UniversalParser.parse('   ')).toBeNull();
    });

    it('should handle ₹ with space before amount', () => {
      const result = UniversalParser.parse('₹ 500 paid');
      expect(result?.amountPaise).toBe(50000);
    });

    it('should handle whole number without decimals', () => {
      const result = UniversalParser.parse('₹100 sent');
      expect(result?.amountPaise).toBe(10000);
    });

    it('should always return INR as currency', () => {
      const result = UniversalParser.parse('₹1 paid');
      expect(result?.currency).toBe('INR');
    });
  });

  describe('isPromotional — keyword detection', () => {
    it('should flag "cashback" as promotional', () => {
      expect(UniversalParser.isPromotional('You earned ₹50 cashback!')).toBe(true);
    });

    it('should flag "offer" as promotional', () => {
      expect(UniversalParser.isPromotional('Special offer: 50% off')).toBe(true);
    });

    it('should flag "reward" as promotional', () => {
      expect(UniversalParser.isPromotional('Special reward for you.')).toBe(true);
    });

    it('should flag "win" as promotional', () => {
      expect(UniversalParser.isPromotional('You can win ₹10000!')).toBe(true);
    });

    it('should flag "discount" as promotional', () => {
      expect(UniversalParser.isPromotional('Get 20% discount on your next order.')).toBe(true);
    });

    it('should flag "congratulations" as promotional', () => {
      expect(UniversalParser.isPromotional('Congratulations! You won cashback.')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(UniversalParser.isPromotional('CONGRATULATIONS! BIG WIN!')).toBe(true);
    });
  });

  describe('isPromotional — false negatives (real transactions must pass through)', () => {
    it('should NOT flag "Paid ₹500 to Rahul"', () => {
      expect(UniversalParser.isPromotional('Paid ₹500 to Rahul')).toBe(false);
    });

    it('should NOT flag "₹150 debited from a/c"', () => {
      expect(UniversalParser.isPromotional('₹150 debited from a/c')).toBe(false);
    });

    it('should NOT flag "₹3,000 received from Arun"', () => {
      expect(UniversalParser.isPromotional('₹3,000 received from Arun')).toBe(false);
    });

    it('should NOT flag bank debit SMS', () => {
      expect(UniversalParser.isPromotional('A/C *1234 debited ₹999 on 14-May')).toBe(false);
    });
  });

  describe('parse — real-life user messages', () => {
    it('should parse ICICI Bank debit with credited beneficiary (correctly identified as debit)', () => {
      const msg = 'ICICI Bank Acct XX041 debited for Rs 75.00 on 15-May-26; SHAIK IMRAN AHM credited. UPI:737761560069. Call 18002662 for dispute. SMS BLOCK 041 to 9215676766';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(7500);
    });

    it('should parse ICICI Bank credit', () => {
      const msg = 'Dear Customer, Acct XX041 is credited with Rs 1760.00 on 13-May-26 from TULALA HARSHA G. UPI:123337608996-ICICI Bank.';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(-176000);
    });

    it('should parse SBI debit without currency symbol', () => {
      const msg = 'Dear UPI user A/C X6090 debited by 15.00 on date 03Apr26 trf to AVENUE FOOD PLAZ Refno 830400847000 If not u? call-1800111109 for other services-18001234-SBI';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(1500);
    });

    it('should parse HSBC debit with typo "NR"', () => {
      const msg = 'NR 1000.00 is paid from HSBC account XXXXXX1006 to BEHERA TATHAGAT on 11-May-26 with ref 613101256215.';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(100000);
    });

    it('should parse HSBC debit', () => {
      const msg = 'INR 1140.00 is paid from HSBC account XXXXXX1006 to Yum Yum Tree Arabian Food Court on 08-May-26 with ref 275210596918.';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(114000);
    });

    it('should parse Union Bank debit with colon "Rs:"', () => {
      const msg = 'A/c *1114 Debited for Rs:500.00 on 13-05-2026 17:05:09 by Mob Bk ref no 709515471120 Avl Bal Rs:20.55.';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(50000);
    });

    it('should parse HDFC Sent UPI debit', () => {
      const msg = 'Sent Rs.200.00\nFrom HDFC Bank A/C *6084\nTo Zepto\nOn 16/05/26\nRef 134956946180';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(20000);
    });

    it('should parse HDFC Credit Alert', () => {
      const msg = 'Credit Alert!\nRs.702.00 credited to HDFC Bank A/c XX6084 on 13-05-26 from VPA 8639853866@axl (UPI 863660968463)';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(-70200);
    });

    it('should parse YES Bank Credit Card Statement (total due)', () => {
      const msg = 'YES BANK Credit Card XX7615 MAY-26 statement: Total due INR 5239.00  Min due INR 200.00 Due by 03-JUN-2026.';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(523900);
    });

    it('should parse YES Bank Card Spend', () => {
      const msg = 'INR 1,166.00 spent on YES BANK Card X7615 @TATAUNISTORELTD 13-05-2026 10:40:51 pm. Avl Lmt INR 246,439.00.';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(116600);
    });

    it('should parse KVB debit', () => {
      const msg = 'Your a/c XXXXXXXXXXXX4430 is debited Rs. 1450.00 on 16-May-2026 to GUDLA  AMMAJAMMA info :P2A/650247179317. Avl Bal INR 7255.11 Not You? call 18005721916-KVB';
      const result = UniversalParser.parse(msg);
      expect(result).not.toBeNull();
      expect(result!.amountPaise).toBe(145000);
    });

    it('should ignore KVB Balance Alert', () => {
      const msg = 'KVB ALERT * INR 8,705.11 is the Balance in a/c **4430 as of 16-MAY-2026 00:55:03 * Download KVB-DLite mobile app';
      const result = UniversalParser.parse(msg);
      expect(result).toBeNull();
    });

    it('should handle registration info alert (ignored)', () => {
      const msg = 'Dear Customer, registration for SUPERMONEY has started for YES BANK. If it was not you, report to your bank.';
      const result = UniversalParser.parse(msg);
      expect(result).toBeNull();
    });

    it('should handle limit warnings (ignored)', () => {
      const msg = 'Dear Customer, a cooling period limit of Rs. 5000 every 24 hours is applicable for the first 72 hours. Never share UPI PIN';
      const result = UniversalParser.parse(msg);
      expect(result).toBeNull();
    });
  });
});
