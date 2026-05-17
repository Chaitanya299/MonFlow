import { RuleManager } from './RuleManager';

export type TrustLevel = 'VERIFIED' | 'SCAM_RISK' | 'UNKNOWN';

export interface Transaction {
  amountPaise: number;
  currency: string;
  trustLevel: TrustLevel;
}

const DEFAULT_CURRENCY = 'INR';
const CURRENCY_SYMBOL = '₹';

// Default Regex for performance.
const DEFAULT_AMOUNT_REGEX = new RegExp(
  `(-?\\${CURRENCY_SYMBOL}-?)\\s?([\\d,]+(?:\\.\\d+)?)`
);

export const UniversalParser = {
  /**
   * Analyzes the TRAI SMS header for security verification.
   */
  getSmsMetadata: (sourcePackage: string): { brand: string, suffix: string, trust: TrustLevel } => {
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

    return {
      brand,
      suffix,
      trust: isVerified ? 'VERIFIED' : 'UNKNOWN'
    };
  },

  /**
   * Normalizes raw text to standard format (Rs, INR -> ₹)
   * to simplify the regex brain.
   */
  normalize: (text: string): string => {
    return text
      .replace(/INR\s?/gi, CURRENCY_SYMBOL)
      .replace(/Rs\.?\s?/gi, CURRENCY_SYMBOL)
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Determines if a transaction is a credit (negative amount in our model)
   * or a debit (positive amount).
   */
  isCredit: (text: string): boolean => {
    const CREDIT_KEYWORDS = ['received', 'credited', 'refunded', 'reversal'];
    const lowerText = text.toLowerCase();
    return CREDIT_KEYWORDS.some(kw => lowerText.includes(kw));
  },

  /**
   * Parses a transaction alert string into a Transaction object.
   * Uses integer arithmetic (paise) to ensure 100% accuracy.
   */
  parse: (text: string, sourcePackage: string = 'app'): Transaction | null => {
    if (!text) return null;

    const normalizedText = UniversalParser.normalize(text);
    const metadata = UniversalParser.getSmsMetadata(sourcePackage);

    // Try dynamic rules first
    const dynamicRules = RuleManager.getRules();
    for (const rule of dynamicRules) {
      try {
        const regex = new RegExp(rule.pattern, rule.flags);
        const match = normalizedText.match(regex);
        if (match) {
          return UniversalParser.extractFromMatch(match, normalizedText, metadata.trust);
        }
      } catch (e) {
        console.error(`Invalid dynamic rule: ${rule.id}`, e);
      }
    }

    // Fallback to default regex
    const match = normalizedText.match(DEFAULT_AMOUNT_REGEX);
    if (!match) return null;

    return UniversalParser.extractFromMatch(match, normalizedText, metadata.trust);
  },

  /**
   * Helper to extract transaction data from a regex match.
   * Assumes capture group 1 is the symbol (potentially with sign) and group 2 is the number.
   */
  extractFromMatch: (match: RegExpMatchArray, originalText: string, trustLevel: TrustLevel): Transaction | null => {
    const symbolPart = match[1];
    const hasNegativeSign = symbolPart.includes('-');
    const isCredit = UniversalParser.isCredit(originalText);

    // Remove commas and parse to float first to handle the decimal part
    const rawAmount = parseFloat(match[2].replace(/,/g, ''));

    // Convert to paise (integer)
    let amountPaise = Math.round(rawAmount * 100);

    // In Monflo's model:
    // Expenses (Debits) = Positive integer
    // Income/Refunds (Credits) = Negative integer
    if (isCredit || hasNegativeSign) {
      amountPaise = -Math.abs(amountPaise);
    } else {
      amountPaise = Math.abs(amountPaise);
    }

    return {
      amountPaise,
      currency: DEFAULT_CURRENCY,
      trustLevel
    };
  },

  /**
   * Checks if a string contains promotional keywords.
   */
  isPromotional: (text: string, sourcePackage: string = 'app'): boolean => {
    // 1. Check TRAI suffix first (High confidence)
    if (sourcePackage.startsWith('sms:')) {
      const metadata = UniversalParser.getSmsMetadata(sourcePackage);
      if (metadata.suffix === 'P') return true;
    }

    // 2. Keyword fallback
    const PROMO_KEYWORDS = ["offer", "reward", "cashback", "win", "discount", "congratulations"];
    const lowerText = text.toLowerCase();
    return PROMO_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }
};
