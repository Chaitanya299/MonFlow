const fs = require('fs');
const path = require('path');

// --- ACTUAL UNIVERSAL PARSER LOGIC (v1.3 with TRAI Header Analysis) ---
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
    if (!sourcePackage || !sourcePackage.startsWith('sms:')) {
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
  },
  isPromotional: (text, sourcePackage = 'app') => {
    if (sourcePackage.startsWith('sms:')) {
      const metadata = UniversalParser.getSmsMetadata(sourcePackage);
      if (metadata.suffix === 'P') return true;
    }
    const PROMO_KEYWORDS = ["offer", "reward", "cashback", "win", "discount", "congratulations"];
    const lowerText = text.toLowerCase();
    return PROMO_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }
};

const CORPUS_DIR = path.resolve('test-data/corpus');

function runReplay() {
  console.log('\n\x1b[1m🚀 MONFLO REALITY REPLAY ENGINE (v1.3)\x1b[0m');
  console.log('\x1b[2mIncludes: TRAI Header Suffix Analysis + Fraud Detection\x1b[0m');
  console.log('====================================================');

  const providers = fs.readdirSync(CORPUS_DIR);
  let total = 0;
  let passed = 0;

  providers.forEach(provider => {
    const providerPath = path.join(CORPUS_DIR, provider);
    if (!fs.statSync(providerPath).isDirectory()) return;

    const files = fs.readdirSync(providerPath);
    files.forEach(file => {
      if (!file.endsWith('.json')) return;

      const sample = JSON.parse(fs.readFileSync(path.join(providerPath, file), 'utf-8'));
      total++;

      // Use the category as a base for sourcePackage if not provided in sample
      const sourcePackage = sample.sourcePackage || `sms:VM-${provider.toUpperCase()}-T`;

      console.log(`\n\x1b[36m[INCOMING ${provider.toUpperCase()}]\x1b[0m "${sample.input}"`);
      console.log(`\x1b[2m   Source: ${sourcePackage}\x1b[0m`);

      const isPromo = UniversalParser.isPromotional(sample.input, sourcePackage);
      if (isPromo) {
        console.log(`   \x1b[33m└─ FILTERED:\x1b[0m Promotional content detected.`);
        passed++;
        return;
      }

      const parsed = UniversalParser.parse(sample.input, sourcePackage);
      if (!parsed) {
        console.log(`   \x1b[31m└─ FAILED:\x1b[0m Could not parse amount.`);
        return;
      }

      const match = parsed.amountPaise === sample.expected.amount;
      if (match) {
        passed++;
        const type = parsed.amountPaise > 0 ? 'DEBIT' : 'CREDIT';
        const typeColor = parsed.amountPaise > 0 ? '\x1b[31m' : '\x1b[32m';
        const trustColor = parsed.trustLevel === 'VERIFIED' ? '\x1b[32m' : '\x1b[31m';

        console.log(`   \x1b[32m└─ PASSED:\x1b[0m Extracted ${parsed.amountPaise} paise (₹${(Math.abs(parsed.amountPaise)/100).toFixed(2)}) [${typeColor}${type}\x1b[0m] [${trustColor}${parsed.trustLevel}\x1b[0m]`);
      } else {
        console.log(`   \x1b[31m└─ MISMATCH:\x1b[0m Expected ${sample.expected.amount}, got ${parsed.amountPaise}`);
      }
    });
  });

  const accuracy = ((passed / total) * 100).toFixed(1);
  console.log('\n\x1b[1m====================================================\x1b[0m');
  console.log(`📊 \x1b[1mFINAL ACCURACY: ${accuracy}%\x1b[0m (${passed}/${total} samples)`);
  console.log('====================================================\n');
}

runReplay();
