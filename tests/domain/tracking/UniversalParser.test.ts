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
});
