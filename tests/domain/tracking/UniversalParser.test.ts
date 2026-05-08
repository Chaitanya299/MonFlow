import { describe, it, expect } from 'vitest';
import { UniversalParser } from '../../../src/domain/tracking/UniversalParser';

describe('UniversalParser', () => {
  it('should parse a simple UPI notification', () => {
    const result = UniversalParser.parse('Paid ₹500 to Rahul');
    expect(result?.amount).toBe(500);
    expect(result?.currency).toBe('INR');
  });

  it('should parse decimal amounts correctly', () => {
    const result = UniversalParser.parse('Paid ₹500.50 to Rahul');
    expect(result?.amount).toBe(500.50);
  });

  it('should return 0 amount if symbol exists but no digits follow', () => {
    const result = UniversalParser.parse('Paid ₹ to Rahul');
    expect(result?.amount).toBe(0);
  });

  it('should return null if no currency symbol is found', () => {
    const result = UniversalParser.parse('Paid 500 to Rahul');
    expect(result).toBeNull();
  });

  it('should return null for empty input', () => {
    expect(UniversalParser.parse('')).toBeNull();
  });

  it('should parse the first amount if multiple symbols are present', () => {
    const result = UniversalParser.parse('Paid ₹500 and received ₹200');
    expect(result?.amount).toBe(500);
  });
});
