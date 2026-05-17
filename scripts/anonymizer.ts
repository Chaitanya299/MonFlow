import * as fs from 'fs';
import * as path from 'path';

/**
 * Monflo Anonymizer Utility
 *
 * Scrubs PII (names, phone numbers, account numbers, UPI IDs) from raw
 * financial notifications to ensure the test corpus maintains privacy.
 */
export class Anonymizer {
  private static NAME_PATTERNS = [
    /to ([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /from ([A-Z][a-z]+ [A-Z][a-z]+)/g,
    /Dear ([A-Z][a-z]+)/g
  ];

  private static ACCOUNT_PATTERNS = [
    /A\/c (?:X+|x+)(\d+)/g,
    /account (?:X+|x+)(\d+)/g,
    /card (?:X+|x+)(\d+)/g
  ];

  private static UPI_PATTERNS = [
    /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g
  ];

  private static PHONE_PATTERNS = [
    /(?:\+91|0)?[6-9]\d{9}/g
  ];

  /**
   * Scrubs a single string of PII.
   */
  static scrub(text: string): string {
    let scrubbed = text;

    // 1. Scrub UPI IDs first (most specific)
    scrubbed = scrubbed.replace(this.UPI_PATTERNS[0], 'user@upi');

    // 2. Scrub Phone Numbers
    scrubbed = scrubbed.replace(this.PHONE_PATTERNS[0], '+91-XXXXX-XXXXX');

    // 3. Scrub Account/Card numbers
    this.ACCOUNT_PATTERNS.forEach(pattern => {
      scrubbed = scrubbed.replace(pattern, (match, suffix) => {
        return match.replace(suffix, 'XXXX');
      });
    });

    // 4. Scrub Names (heuristic-based)
    this.NAME_PATTERNS.forEach(pattern => {
      scrubbed = scrubbed.replace(pattern, (match, name) => {
        return match.replace(name, 'User');
      });
    });

    return scrubbed;
  }

  /**
   * Helper to process a raw text file and save the scrubbed version.
   */
  static processFile(inputPath: string, outputPath: string) {
    const raw = fs.readFileSync(inputPath, 'utf-8');
    const scrubbed = this.scrub(raw);
    fs.writeFileSync(outputPath, scrubbed);
    console.log(`✅ Processed: ${path.basename(inputPath)} -> ${outputPath}`);
  }
}

// Simple CLI runner
if (require.main === module) {
  const input = process.argv[2];
  if (input) {
    console.log(Anonymizer.scrub(input));
  }
}
