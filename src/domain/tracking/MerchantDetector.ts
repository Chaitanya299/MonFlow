import { TransactionCategory } from '../accounting/types';
import merchantRulesData from './merchant-rules.json';

interface MerchantRule {
  exactPatterns: string[];
  category: TransactionCategory;
  priority: number;
}

interface MerchantRulesConfig {
  rules: MerchantRule[];
  fuzzyThreshold: number;
  maxCacheSize: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  rules: MerchantRule[];
}

export class MerchantDetector {
  private static instance: MerchantDetector;
  private trie: TrieNode = { children: new Map(), rules: [] };
  private rules: MerchantRule[] = [];
  private config: MerchantRulesConfig;
  private cache: Map<string, TransactionCategory>;
  private cacheOrder: string[] = [];

  private constructor() {
    this.config = merchantRulesData as MerchantRulesConfig;
    this.cache = new Map();
    this.rules = this.config.rules;
    this.buildTrie();
  }

  static getInstance(): MerchantDetector {
    if (!MerchantDetector.instance) {
      MerchantDetector.instance = new MerchantDetector();
    }
    return MerchantDetector.instance;
  }

  private buildTrie(): void {
    for (const rule of this.rules) {
      for (const pattern of rule.exactPatterns) {
        const normalized = pattern.toLowerCase().trim();
        let node = this.trie;
        for (const char of normalized) {
          if (!node.children.has(char)) {
            node.children.set(char, { children: new Map(), rules: [] });
          }
          node = node.children.get(char)!;
        }
        node.rules.push(rule);
      }
    }
  }

  categorize(merchantName: string | null): TransactionCategory {
    if (!merchantName || !merchantName.trim()) {
      return 'untagged';
    }

    const normalized = merchantName.toLowerCase().trim();

    // Check cache first
    if (this.cache.has(normalized)) {
      return this.cache.get(normalized)!;
    }

    // Try exact match (Trie lookup)
    const exactMatch = this.exactMatch(normalized);
    if (exactMatch) {
      this.updateCache(normalized, exactMatch);
      return exactMatch;
    }

    // Try fuzzy match (Levenshtein distance)
    const fuzzyMatch = this.fuzzyMatch(normalized);
    if (fuzzyMatch) {
      this.updateCache(normalized, fuzzyMatch);
      return fuzzyMatch;
    }

    // Default to untagged
    this.updateCache(normalized, 'untagged');
    return 'untagged';
  }

  private exactMatch(normalized: string): TransactionCategory | null {
    let node = this.trie;
    for (const char of normalized) {
      if (!node.children.has(char)) {
        return null;
      }
      node = node.children.get(char)!;
    }

    if (node.rules.length > 0) {
      const bestRule = node.rules.reduce((best, rule) => {
        return rule.priority > best.priority ? rule : best;
      });
      return bestRule.category;
    }

    return null;
  }

  private fuzzyMatch(normalized: string): TransactionCategory | null {
    let bestMatch: { rule: MerchantRule; distance: number } | null = null;
    const threshold = this.config.fuzzyThreshold;

    for (const rule of this.rules) {
      for (const pattern of rule.exactPatterns) {
        const distance = this.levenshteinDistance(normalized, pattern);
        const maxLen = Math.max(normalized.length, pattern.length);
        const similarity = 1 - distance / maxLen;

        if (similarity >= threshold) {
          if (!bestMatch || similarity > 1 - bestMatch.distance / maxLen || rule.priority > bestMatch.rule.priority) {
            bestMatch = { rule, distance };
          }
        }
      }
    }

    return bestMatch ? bestMatch.rule.category : null;
  }

  private levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array(a.length + 1)
      .fill(null)
      .map(() => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[a.length][b.length];
  }

  private updateCache(key: string, value: TransactionCategory): void {
    if (this.cache.has(key)) {
      const index = this.cacheOrder.indexOf(key);
      if (index > -1) this.cacheOrder.splice(index, 1);
    }

    this.cache.set(key, value);
    this.cacheOrder.push(key);

    if (this.cacheOrder.length > this.config.maxCacheSize) {
      const removed = this.cacheOrder.shift();
      if (removed) this.cache.delete(removed);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheOrder = [];
  }

  getRuleCount(): number {
    return this.rules.length;
  }
}
