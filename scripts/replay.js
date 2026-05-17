const fs = require('fs');
const path = require('path');

// --- ACTUAL UNIVERSAL PARSER LOGIC (v1.3 with TRAI Header Analysis) ---
const CURRENCY_SYMBOL = '₹';
const DEFAULT_AMOUNT_REGEX = new RegExp(
  `(-?\\${CURRENCY_SYMBOL}-?)\\s?([\\d,]+(?:\\.\\d+)?)`
);

const NO_SYMBOL_PATTERNS = [
  /debited\s+by\s+([\d,]+(?:\.\d+)?)/i,
  /credited\s+with\s+([\d,]+(?:\.\d+)?)/i,
  /paid\s+([\d,]+(?:\.\d+)?)/i,
  /spent\s+([\d,]+(?:\.\d+)?)/i,
  /sent\s+([\d,]+(?:\.\d+)?)/i
];

const NON_TRANSACTION_KEYWORDS = [
  'cooling period',
  'limit of',
  'registration for',
  'is the balance',
  'balance in a/c'
];

const UniversalParser = {
  normalize: (text) => {
    return text
      .replace(/(\b(INR|Rs|NR))\.?\s?:?\s?/gi, CURRENCY_SYMBOL)
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
    const lowerText = text.toLowerCase();

    // If it contains strong debit indicators, it's a debit (expense),
    // unless it specifically says "credited to" or "credited with".
    if (
      lowerText.includes('debited') ||
      lowerText.includes('paid') ||
      lowerText.includes('spent') ||
      lowerText.includes('sent')
    ) {
      if (lowerText.includes('credited to') || lowerText.includes('credited with')) {
        return true;
      }
      return false;
    }

    const CREDIT_KEYWORDS = ['received', 'credited', 'refunded', 'reversal'];
    return CREDIT_KEYWORDS.some(kw => lowerText.includes(kw));
  },
  parse: (text, sourcePackage = 'app') => {
    if (!text) return null;

    const lowerText = text.toLowerCase();
    if (NON_TRANSACTION_KEYWORDS.some(kw => lowerText.includes(kw))) {
      return null;
    }

    const normalizedText = UniversalParser.normalize(text);
    const metadata = UniversalParser.getSmsMetadata(sourcePackage);

    // Fallback to default regex
    let match = normalizedText.match(DEFAULT_AMOUNT_REGEX);
    if (!match) {
      const isBankSms = /a\/c|acct|account|bank|ref\s*no|refno|trf|upi/i.test(normalizedText);
      if (isBankSms) {
        // Try patterns without currency symbol
        for (const pattern of NO_SYMBOL_PATTERNS) {
          const noSymbolMatch = normalizedText.match(pattern);
          if (noSymbolMatch) {
            match = [noSymbolMatch[0], CURRENCY_SYMBOL, noSymbolMatch[1]];
            break;
          }
        }
      }
    }

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
        if (sample.expected === null) {
          passed++;
          console.log(`   \x1b[32m└─ PASSED:\x1b[0m Correctly ignored (returned null).`);
        } else {
          console.log(`   \x1b[31m└─ FAILED:\x1b[0m Could not parse amount.`);
        }
        return;
      }

      if (sample.expected === null) {
        console.log(`   \x1b[31m└─ MISMATCH:\x1b[0m Expected null (ignored), but parsed amount ${parsed.amountPaise}`);
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
