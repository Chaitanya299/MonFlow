export interface Transaction {
  amount: number;
  currency: string;
}

const DEFAULT_CURRENCY = 'INR';
const CURRENCY_SYMBOL = '₹';

export const UniversalParser = {
  /**
   * Parses a transaction alert string into a Transaction object.
   * Handles decimals and uses the default currency symbol.
   */
  parse: (text: string): Transaction | null => {
    if (!text || !text.includes(CURRENCY_SYMBOL)) {
      return null;
    }

    // Regex handles integers and decimals (e.g. 500 or 500.50)
    const amountMatch = text.match(new RegExp(`${CURRENCY_SYMBOL}(\\d+(?:\\.\\d+)?)`));
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    return {
      amount,
      currency: DEFAULT_CURRENCY
    };
  }
};
