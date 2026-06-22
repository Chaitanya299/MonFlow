import { TransactionStatus } from './types';

export class Deduplicator {
  private static semanticCache: Map<string, { timestamp: number; status: TransactionStatus }> = new Map();
  private static rawCache: { text: string; timestamp: number; amountPaise: number }[] = [];

  private static MAX_CACHE_SIZE = 200;
  private static TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static MAX_LEVENTHSHTEIN_LEN = 150; // Strict limit to prevent CPU and memory exhaustion

  /**
   * Generates a highly specific semantic hash for a transaction.
   * Leverages referenceId (when available) for exact collision tracking.
   * Otherwise, falls back to a compound key of merchant, 2-minute rounded time,
   * absolute amount, direction, and account fingerprint context.
   */
  static getSemanticHash(
    merchant: string | null,
    timestamp: number,
    amountPaise: number,
    referenceId: string | null = null,
    accountFingerprint: string | null = null
  ): string {
    if (referenceId) {
      return `ref_${referenceId.toLowerCase().trim()}`;
    }

    const cleanMerchant = (merchant || 'unknown').toLowerCase().replace(/\s+/g, '');
    const roundedTime = Math.round(timestamp / (2 * 60 * 1000)); // 2-minute window
    const absAmount = Math.abs(amountPaise);
    const direction = amountPaise >= 0 ? 'debit' : 'credit';
    const cleanAccount = (accountFingerprint || 'unknown').toLowerCase().trim();

    return `${cleanMerchant}_${roundedTime}_${absAmount}_${direction}_${cleanAccount}`;
  }

  /**
   * Evaluates if a transaction alert is a duplicate using a two-pass approach:
   * 1. Primary Pass: Semantic hashing with account, reference ID, and lifecycle tracking.
   * 2. Secondary Pass: Bounded Levenshtein distance fallback (max 150 chars).
   */
  static isDuplicate(
    rawText: string,
    merchant: string | null,
    timestamp: number,
    amountPaise: number,
    referenceId: string | null = null,
    accountFingerprint: string | null = null,
    status: TransactionStatus = 'success'
  ): boolean {
    const now = Date.now();
    this.evictStaleEntries(now);

    // 1. Primary Pass: Semantic Hash Match
    const hash = this.getSemanticHash(merchant, timestamp, amountPaise, referenceId, accountFingerprint);
    const cached = this.semanticCache.get(hash);

    if (cached) {
      // If the reference ID matches but the transaction status has progressed
      // (e.g. from 'initiated' or 'pending' to 'success'), it is a lifecycle update,
      // not a duplicate alert. Allow it through and update status in cache.
      if (cached.status !== status) {
        this.semanticCache.set(hash, { timestamp: now, status });
        return false;
      }
      return true;
    }

    // 2. Secondary Pass: Levenshtein Fuzzy Match
    if (rawText.length <= this.MAX_LEVENTHSHTEIN_LEN) {
      for (const entry of this.rawCache) {
        // Safety Precaution: ONLY evaluate fuzzy match if absolute paise amount is identical.
        if (Math.abs(amountPaise) !== Math.abs(entry.amountPaise)) {
          continue;
        }

        const distance = this.getLevenshteinDistance(rawText, entry.text);
        const maxLength = Math.max(rawText.length, entry.text.length);
        const similarity = maxLength === 0 ? 1.0 : 1.0 - distance / maxLength;

        if (similarity > 0.85) {
          return true;
        }
      }
    }

    // Insert new records & enforce strict memory pressure bounds (LRU)
    if (this.semanticCache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.semanticCache.keys().next().value;
      if (oldestKey) this.semanticCache.delete(oldestKey);
    }
    this.semanticCache.set(hash, { timestamp: now, status });

    if (this.rawCache.length >= this.MAX_CACHE_SIZE) {
      this.rawCache.shift();
    }
    this.rawCache.push({ text: rawText, timestamp: now, amountPaise });

    return false;
  }

  private static evictStaleEntries(now: number): void {
    // Evict Semantic cache
    for (const [key, cached] of this.semanticCache.entries()) {
      if (now - cached.timestamp > this.TTL_MS) {
        this.semanticCache.delete(key);
      }
    }

    // Evict Raw text cache
    this.rawCache = this.rawCache.filter(entry => now - entry.timestamp < this.TTL_MS);
  }

  private static getLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1  // deletion
            )
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  static clear(): void {
    this.semanticCache.clear();
    this.rawCache = [];
  }
}
