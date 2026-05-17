import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: {
      getRules: () => [],
      saveRules: () => {},
    },
  },
}));

import { UniversalParser } from '../src/domain/tracking/UniversalParser';

/**
 * Monflo Normalization Fuzzer
 *
 * Intentionally generates malformed and edge-case currency strings
 * to ensure the Normalization layer is bulletproof.
 */
describe('Normalization Fuzzing & Stress Test', () => {
  const baseAmount = 1500.50;
  const expectedPaise = 150050;

  const variations = [
    // 1. Spacing Fuzzing
    '₹ 1500.50',       // Leading space
    '₹  1500.50',      // Double leading space
    '₹1500.50 ',       // Trailing space
    ' ₹1500.50',       // Leading space before symbol

    // 2. Case & Format Fuzzing
    'rs 1500.50',      // Lowercase rs
    'RS 1500.50',      // Uppercase RS
    'Rs1500.50',       // Rs no space
    'Rs. 1500.50',     // Rs dot and space
    'Rs.1500.50',      // Rs dot no space

    // 3. INR Fuzzing
    'inr 1500.50',     // Lowercase inr
    'INR1500.50',      // Uppercase INR no space
    'INR 1500.50',     // Uppercase INR space

    // 4. Indian Comma Notation Stress
    '₹1,500.50',       // Standard
    '₹ 1,500.50',      // Space + Comma
    'Rs. 1,500.50',    // Rs. + Space + Comma

    // 5. Negative/Credit Signs
    '-₹1,500.50',      // Standard negative
    '₹-1,500.50',      // Symbol before negative (unlikely but possible)
    'Rs. -1500.50'     // Rs. with space and negative
  ];

  it('should normalize and parse 100% of fuzzed variations correctly', () => {
    console.log('\n🚀 STARTING NORMALIZATION FUZZER');
    console.log('====================================');

    let passed = 0;

    variations.forEach((variant, index) => {
      const input = `Paid ${variant} to Test`;
      const result = UniversalParser.parse(input);

      const success = result?.amountPaise === expectedPaise || result?.amountPaise === -expectedPaise;

      if (success) {
        passed++;
        console.log(`[PASS] Case #${index + 1}: "${variant}" -> ${result?.amountPaise}`);
      } else {
        console.log(`\x1b[31m[FAIL]\x1b[0m Case #${index + 1}: "${variant}" -> Got: ${result?.amountPaise}`);
      }
    });

    console.log('------------------------------------');
    console.log(`📊 FUZZ RESULTS: ${passed}/${variations.length} Passed`);
    console.log('====================================\n');

    expect(passed).toBe(variations.length);
  });

  it('should handle zero amounts and edge decimals', () => {
    expect(UniversalParser.parse('Paid ₹0.00')?.amountPaise).toBe(0);
    expect(UniversalParser.parse('Paid ₹0.01')?.amountPaise).toBe(1);
    expect(UniversalParser.parse('Paid ₹0.1')?.amountPaise).toBe(10);
  });
});
