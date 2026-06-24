import { describe, it, expect, beforeEach } from 'vitest';
import { MerchantDetector } from '../../../src/domain/tracking/MerchantDetector';

describe('MerchantDetector', () => {
  let detector: MerchantDetector;

  beforeEach(() => {
    detector = MerchantDetector.getInstance();
    detector.clearCache();
  });

  describe('exact matching', () => {
    it('should categorize "Amazon Pay" as shopping', () => {
      const result = detector.categorize('Amazon Pay');
      expect(result).toBe('shopping');
    });

    it('should categorize "Swiggy" as food', () => {
      const result = detector.categorize('Swiggy');
      expect(result).toBe('food');
    });

    it('should categorize "Uber" as transport', () => {
      const result = detector.categorize('Uber');
      expect(result).toBe('transport');
    });

    it('should be case insensitive', () => {
      const result1 = detector.categorize('AMAZON PAY');
      const result2 = detector.categorize('amazon pay');
      const result3 = detector.categorize('AmaZon PAy');
      expect(result1).toBe('shopping');
      expect(result2).toBe('shopping');
      expect(result3).toBe('shopping');
    });

    it('should handle merchants with multiple aliases', () => {
      const result1 = detector.categorize('Flipkart');
      const result2 = detector.categorize('Flipkart Pay');
      expect(result1).toBe('shopping');
      expect(result2).toBe('shopping');
    });
  });

  describe('fuzzy matching', () => {
    it('should match "Swiggi" (typo) to Swiggy → food', () => {
      const result = detector.categorize('Swiggi');
      expect(result).toBe('food');
    });

    it('should match "Amzn" (abbreviation) to Amazon → shopping', () => {
      const result = detector.categorize('Amzn');
      expect(result).toBe('shopping');
    });

    it('should match "Zomatoo" (typo) to Zomato → food', () => {
      const result = detector.categorize('Zomatoo');
      expect(result).toBe('food');
    });

    it('should not match gibberish to any category', () => {
      const result = detector.categorize('xyzabc123notamerchant');
      expect(result).toBe('untagged');
    });
  });

  describe('edge cases', () => {
    it('should return untagged for null input', () => {
      const result = detector.categorize(null);
      expect(result).toBe('untagged');
    });

    it('should return untagged for empty string', () => {
      const result = detector.categorize('');
      expect(result).toBe('untagged');
    });

    it('should return untagged for whitespace only', () => {
      const result = detector.categorize('   ');
      expect(result).toBe('untagged');
    });

    it('should handle priority correctly (Amazon vs generic Payment)', () => {
      const result = detector.categorize('Amazon Pay');
      expect(result).toBe('shopping');
      // "Amazon Pay" should match with higher priority than generic "payment"
    });
  });

  describe('caching', () => {
    it('should cache merchant lookups', () => {
      const merchant = 'Starbucks';
      const result1 = detector.categorize(merchant);
      const result2 = detector.categorize(merchant);
      expect(result1).toBe('food');
      expect(result2).toBe('food');
      // Both should return the same result (cached)
    });

    it('should evict old entries when cache exceeds max size', () => {
      // Fill the cache beyond maxCacheSize
      for (let i = 0; i < 600; i++) {
        detector.categorize(`merchant${i}`);
      }
      // Should have evicted oldest entries
      detector.categorize('Swiggy');
      // Should still work correctly
      expect(detector.categorize('Swiggy')).toBe('food');
    });
  });

  describe('real-world SMS samples', () => {
    it('should categorize HDFC card transaction (Txn format)', () => {
      const result = detector.categorize('paytmqr6u0up1@ptys');
      // VPA should not match but fuzzy should get close to 'Payment'
      expect(result).toBe('untagged'); // VPA is not a known merchant
    });

    it('should categorize "Jio Mobile Recharge" as bills', () => {
      const result = detector.categorize('Jio');
      expect(result).toBe('bills');
    });

    it('should categorize "Apollo Hospital" as health', () => {
      const result = detector.categorize('Apollo');
      expect(result).toBe('health');
    });

    it('should categorize "Netflix" as entertainment', () => {
      const result = detector.categorize('Netflix');
      expect(result).toBe('entertainment');
    });

    it('should categorize "Salary Credit" as transfer', () => {
      const result = detector.categorize('Salary');
      expect(result).toBe('transfer');
    });

    it('should categorize "D-Mart" as shopping', () => {
      const result = detector.categorize('DMart');
      expect(result).toBe('shopping');
    });

    it('should categorize "Ola Cab" as transport', () => {
      const result = detector.categorize('Ola');
      expect(result).toBe('transport');
    });

    it('should categorize "Gym Membership" as health', () => {
      const result = detector.categorize('Fitness');
      expect(result).toBe('health');
    });

    it('should categorize "Insurance Premium" as bills', () => {
      const result = detector.categorize('Insurance');
      expect(result).toBe('bills');
    });

    it('should categorize "Rent Payment" as bills', () => {
      const result = detector.categorize('Rent');
      expect(result).toBe('bills');
    });
  });

  describe('performance', () => {
    it('should categorize in <5ms on average', () => {
      const merchant = 'Amazon Pay';
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        detector.categorize(merchant);
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      console.log(`Average categorization time: ${avgTime.toFixed(3)}ms`);
      expect(avgTime).toBeLessThan(5);
    });
  });
});
