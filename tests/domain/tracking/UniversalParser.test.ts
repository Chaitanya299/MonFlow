import { describe, it, expect } from 'vitest';
import { UniversalParser } from '../../../src/domain/tracking/UniversalParser';

describe('UniversalParser', () => {
  it('should parse a simple UPI notification', () => {
    const result = UniversalParser.parse('Paid ₹500 to Rahul');
    expect(result?.amountPaise).toBe(50000);
    expect(result?.currency).toBe('INR');
  });

  it('should parse amounts with commas (Indian notation)', () => {
    const result = UniversalParser.parse('Paid ₹1,50,000 to Dealer');
    expect(result?.amountPaise).toBe(15000000);
  });

  it('should handle decimal precision using paise', () => {
    const result = UniversalParser.parse('Spent ₹500.50 on lunch');
    expect(result?.amountPaise).toBe(50050);
  });

  it('should handle floating point edge cases (0.1 + 0.2)', () => {
    const result = UniversalParser.parse('₹0.10 and ₹0.20');
    expect(result?.amountPaise).toBe(10);
  });

  it('should parse negative amounts (refunds/reversals)', () => {
    const result = UniversalParser.parse('Refunded -₹500.00');
    expect(result?.amountPaise).toBe(-50000);
  });

  it('should return null if no currency symbol is found', () => {
    const result = UniversalParser.parse('Paid 500 to Rahul');
    expect(result).toBeNull();
  });

  it('should return null for empty input', () => {
    expect(UniversalParser.parse('')).toBeNull();
  });

  describe('isPromotional', () => {
    it('should return true for messages containing promotional keywords', () => {
      expect(UniversalParser.isPromotional('Congratulations! You won cashback.')).toBe(true);
      expect(UniversalParser.isPromotional('Get 20% discount on your next order.')).toBe(true);
      expect(UniversalParser.isPromotional('Special reward for you.')).toBe(true);
    });

    it('should return false for standard transaction messages', () => {
      expect(UniversalParser.isPromotional('Paid ₹500 to Rahul')).toBe(false);
      expect(UniversalParser.isPromotional('₹150 debited from a/c')).toBe(false);
    });
  });
});
