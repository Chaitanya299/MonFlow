import { TransactionCategory } from './types';

/**
 * On-device, rule-based categorization of a parsed transaction into the app's fixed taxonomy.
 *
 * Matches keywords (brand names + strong category words) against the merchant name and raw alert
 * text. First matching rule wins, so rules are ordered most-specific first to resolve collisions
 * (e.g. "Amazon Prime Video" -> entertainment before the broad "amazon" -> shopping rule).
 *
 * groceries fold into `food` and travel folds into `transport` — the app keeps 7 categories.
 * Anything we can't confidently match stays `untagged`, so it lands in the Untagged Bucket for the
 * user to tag by hand rather than being guessed wrong.
 *
 * ponytail: keyword lists, not ML. Tunable, testable, zero deps. Upgrade to MCC/merchant-DB lookup
 * only if real-world miscategorization rate proves it's worth it.
 */
const CATEGORY_RULES: { category: TransactionCategory; keywords: string[] }[] = [
  {
    category: 'food',
    keywords: [
      // dining
      'zomato', 'swiggy', 'dominos', "domino's", 'pizza', 'mcdonald', 'kfc', 'burger king',
      'restaurant', 'cafe', 'coffee', 'starbucks', 'biryani', 'dhaba', 'bakery', 'eatery',
      'dineout', 'food',
      // groceries (fold into food)
      'blinkit', 'zepto', 'instamart', 'bigbasket', 'big basket', 'grofers', 'dmart', 'd-mart',
      'dunzo', 'milkbasket', 'kirana', 'grocery', 'groceries', 'supermarket',
    ],
  },
  {
    category: 'transport',
    keywords: [
      // ride-hailing + local
      'uber', 'ola', 'rapido', 'metro', 'cab', 'taxi', 'auto rickshaw', 'parking',
      // fuel
      'petrol', 'diesel', 'fuel', 'hpcl', 'iocl', 'bpcl', 'indian oil', 'bharat petroleum',
      'fastag', 'toll',
      // travel (folds into transport)
      'irctc', 'railway', 'redbus', 'makemytrip', 'make my trip', 'goibibo', 'ixigo', 'yatra',
      'cleartrip', 'indigo', 'spicejet', 'air india', 'vistara', 'akasa', 'airlines', 'flight',
      'oyo', 'hotel',
    ],
  },
  {
    category: 'entertainment',
    keywords: [
      'netflix', 'spotify', 'hotstar', 'prime video', 'bookmyshow', 'book my show', 'pvr',
      'inox', 'cinema', 'movie', 'youtube premium', 'jiocinema', 'sonyliv', 'zee5', 'gaming',
      'steam', 'playstation', 'xbox', 'disney', 'gaana', 'wynk',
    ],
  },
  {
    category: 'health',
    keywords: [
      'pharmacy', 'pharmeasy', '1mg', 'netmeds', 'apollo', 'medplus', 'medlife', 'hospital',
      'clinic', 'medical', 'diagnostic', 'pathlab', 'practo', 'medicine', 'chemist', 'healthkart',
      'cult.fit', 'cultfit',
    ],
  },
  {
    category: 'bills',
    keywords: [
      'electricity', 'recharge', 'jio', 'airtel', 'vodafone', 'bsnl', 'broadband', 'wifi',
      'act fibernet', 'dth', 'postpaid', 'bbps', 'billdesk', 'tata power', 'adani', 'torrent power',
      'insurance', 'lic ', 'gas bill', 'water bill', 'utility',
    ],
  },
  {
    category: 'shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'snapdeal', 'tatacliq',
      'tata cliq', 'croma', 'reliance digital', 'reliance trends', 'lifestyle', 'shoppers stop',
      'westside', 'decathlon', 'ikea', 'mall',
    ],
  },
];

/**
 * Returns the best-guess category for a transaction, or 'untagged' when nothing matches.
 */
export const categorize = (
  merchantName: string | null,
  rawText: string = ''
): TransactionCategory => {
  const haystack = `${merchantName ?? ''} ${rawText}`.toLowerCase();
  if (!haystack.trim()) return 'untagged';

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.category;
    }
  }
  return 'untagged';
};
