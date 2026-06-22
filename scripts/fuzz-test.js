const fs = require('fs');

// --- UPDATED UNIVERSAL PARSER LOGIC ---
const CURRENCY_SYMBOL = '₹';
const DEFAULT_AMOUNT_REGEX = new RegExp(
  `(-?\\${CURRENCY_SYMBOL}-?)\\s?([\\d,]+(?:\\.\\d+)?)`
);

const UniversalParser = {
  normalize: (text) => {
    return text
      .replace(/INR\s?/gi, CURRENCY_SYMBOL)
      .replace(/Rs\.?\s?/gi, CURRENCY_SYMBOL)
      .replace(/\s+/g, ' ')
      .trim();
  },
  isCredit: (text) => {
    const CREDIT_KEYWORDS = ['received', 'credited', 'refunded', 'reversal'];
    const lowerText = text.toLowerCase();
    return CREDIT_KEYWORDS.some(kw => lowerText.includes(kw));
  },
  parse: (text) => {
    if (!text) return null;
    const normalizedText = UniversalParser.normalize(text);
    const match = normalizedText.match(DEFAULT_AMOUNT_REGEX);
    if (!match) return null;

    const symbolPart = match[1];
    const hasNegativeSign = symbolPart.includes('-');
    const isCredit = UniversalParser.isCredit(normalizedText);
    const rawAmount = parseFloat(match[2].replace(/,/g, ''));
    let amountPaise = Math.round(rawAmount * 100);

    if (isCredit || hasNegativeSign) {
      amountPaise = -Math.abs(amountPaise);
    } else {
      amountPaise = Math.abs(amountPaise);
    }
    return { amountPaise, currency: 'INR' };
  }
};

const variations = [
    '₹ 1500.50', '₹  1500.50', '₹1500.50 ', ' ₹1500.50',
    'rs 1500.50', 'RS 1500.50', 'Rs1500.50', 'Rs. 1500.50', 'Rs.1500.50',
    'inr 1500.50', 'INR1500.50', 'INR 1500.50',
    '₹1,500.50', '₹ 1,500.50', 'Rs. 1,500.50',
    '-₹1,500.50', '₹-1,500.50', 'Rs. -1500.50'
];

function runFuzz() {
  console.log('\n\x1b[1m🚀 MONFLO NORMALIZATION FUZZER (v1.2)\x1b[0m');
  console.log('\x1b[2mFix: Added support for trailing negative signs (₹-)\x1b[0m');
  console.log('====================================================');

  const expectedPaise = 150050;
  let passed = 0;

  variations.forEach((variant, index) => {
    const input = `Paid ${variant} to Test`;
    const result = UniversalParser.parse(input);
    const actualPaise = result ? Math.abs(result.amountPaise) : null;
    const success = actualPaise === expectedPaise;

    if (success) {
      passed++;
      const sign = result.amountPaise < 0 ? '-' : '';
      console.log(`\x1b[32m[PASS]\x1b[0m Case #${(index + 1).toString().padStart(2)}: "${variant.padEnd(15)}" -> ${sign}${actualPaise} paise`);
    } else {
      console.log(`\x1b[31m[FAIL]\x1b[0m Case #${(index + 1).toString().padStart(2)}: "${variant.padEnd(15)}" -> Got: ${result ? result.amountPaise : 'NULL'}`);
    }
  });

  console.log('----------------------------------------------------');
  console.log(`📊 FUZZ RESULTS: ${passed}/${variations.length} Passed`);
  console.log('====================================================\n');
}

runFuzz();
