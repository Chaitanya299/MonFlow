export interface Transaction {
  amountPaise: number; // Stored in minor unit (paise) to prevent precision loss
  currency: string;
}

const DEFAULT_CURRENCY = 'INR';
const CURRENCY_SYMBOL = '₹';

// Pre-compile Regex outside for performance. 
// Escapes symbol and handles: Optional negative sign, digits with commas, and optional decimal.
const AMOUNT_REGEX = new RegExp(
  `(-?\\${CURRENCY_SYMBOL})\\s?([\\d,]+(?:\\.\\d+)?)`
);

export const UniversalParser = {
  /**
   * Parses a transaction alert string into a Transaction object.
   * Uses integer arithmetic (paise) to ensure 100% accuracy.
   */
  parse: (text: string): Transaction | null => {
    if (!text) return null;

    const match = text.match(AMOUNT_REGEX);
    if (!match) return null;

    const isNegative = match[1].startsWith('-');
    
    // Remove commas and parse to float first to handle the decimal part
    const rawAmount = parseFloat(match[2].replace(/,/g, ''));
    
    // Convert to paise (integer)
    let amountPaise = Math.round(rawAmount * 100);
    
    if (isNegative) {
      amountPaise = -amountPaise;
    }

    return {
      amountPaise,
      currency: DEFAULT_CURRENCY
    };
  },

  /**
   * Checks if a string contains promotional keywords.
   */
  isPromotional: (text: string): boolean => {
    const PROMO_KEYWORDS = ["offer", "reward", "cashback", "win", "discount", "congratulations"];
    const lowerText = text.toLowerCase();
    return PROMO_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }
};
