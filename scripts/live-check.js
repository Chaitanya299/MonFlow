const fs = require('fs');

// --- UNIVERSAL PARSER (v1.3 with TRAI Header Analysis) ---
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
  getSmsMetadata: (sourcePackage) => {
    if (!sourcePackage.startsWith('sms:')) {
      return { brand: 'APP', suffix: 'APP', trust: 'VERIFIED' };
    }
    const header = sourcePackage.replace('sms:', '');
    const parts = header.split('-');
    if (parts.length < 2) {
      return { brand: 'UNREGISTERED', suffix: 'NONE', trust: 'SCAM_RISK' };
    }
    const suffix = parts[parts.length - 1].toUpperCase();
    const brand = parts[parts.length - 2].toUpperCase();
    const isVerified = ['T', 'S', 'G'].includes(suffix);
    return { brand, suffix, trust: isVerified ? 'VERIFIED' : 'UNKNOWN' };
  },
  isCredit: (text) => {
    const CREDIT_KEYWORDS = ['received', 'credited', 'refunded', 'reversal'];
    const lowerText = text.toLowerCase();
    return CREDIT_KEYWORDS.some(kw => lowerText.includes(kw));
  },
  parse: (text, sourcePackage = 'app') => {
    if (!text) return null;
    const normalizedText = UniversalParser.normalize(text);
    const metadata = UniversalParser.getSmsMetadata(sourcePackage);
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
    return { amountPaise, currency: 'INR', trustLevel: metadata.trust };
  }
};

function runLiveCheck(input, source = 'app') {
  console.log('\n\x1b[1m🔍 MONFLO LIVE CAPTURE VALIDATOR (v1.3)\x1b[0m');
  console.log('\x1b[2mIncludes: TRAI Header Suffix Analysis\x1b[0m');
  console.log('====================================');
  console.log(`\x1b[36m[SOURCE]\x1b[0m ${source}`);
  console.log(`\x1b[36m[INPUT]\x1b[0m  "${input}"`);

  const parsed = UniversalParser.parse(input, source);

  if (!parsed) {
    console.log('\n\x1b[31m❌ PARSING FAILED\x1b[0m');
    console.log('The engine could not find a valid amount in this message.');
  } else {
    const isExpense = parsed.amountPaise > 0;
    const color = isExpense ? '\x1b[31m' : '\x1b[32m';
    const type = isExpense ? 'EXPENSE' : 'INCOME/REFUND';
    const amount = (Math.abs(parsed.amountPaise) / 100).toFixed(2);

    const trustColor = parsed.trustLevel === 'VERIFIED' ? '\x1b[32m' : '\x1b[31m';

    console.log('\n\x1b[32m✅ PARSING SUCCESS\x1b[0m');
    console.log(`Amount:      \x1b[1m₹${amount}\x1b[0m`);
    console.log(`Type:        ${color}${type}\x1b[0m`);
    console.log(`Trust:       ${trustColor}${parsed.trustLevel}\x1b[0m`);
    console.log(`Paise:       ${parsed.amountPaise} units`);

    console.log('\n📱 \x1b[33mDASHBOARD PREVIEW\x1b[0m');
    console.log('┌──────────────────────────────────────────┐');
    console.log(`│ \x1b[1mMerchant             \x1b[0m ${color}${isExpense ? '-' : '+'} ₹${amount.padStart(10)}\x1b[0m │`);
    console.log(`│ \x1b[2m${source.padEnd(20)}\x1b[0m ${trustColor}${parsed.trustLevel.padStart(16)}\x1b[0m │`);
    console.log('└──────────────────────────────────────────┘');
  }
  console.log('====================================\n');
}

const rawInput = process.argv[2];
const sourceInput = process.argv[3] || 'app';
if (rawInput) {
  runLiveCheck(rawInput, sourceInput);
} else {
  console.log('Usage: node scripts/live-check.js "message" "sms:header"');
}
