import { describe, it, expect } from 'vitest';

// Placeholder for our Universal Transaction Engine
const UniversalParser = {
  parse: (text: string) => {
    if (text.includes('₹')) {
      return { amount: parseFloat(text.match(/₹(\d+)/)?.[1] || '0'), currency: 'INR' };
    }
    return null;
  }
};

describe('UniversalParser', () => {
  it('should parse a simple UPI notification', () => {
    const result = UniversalParser.parse('Paid ₹500 to Rahul');
    expect(result?.amount).toBe(500);
    expect(result?.currency).toBe('INR');
  });
});
