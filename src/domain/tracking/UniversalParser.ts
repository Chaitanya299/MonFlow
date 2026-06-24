import { RuleManager } from './RuleManager';
import { Deduplicator } from './Deduplicator';
import { TelemetryReporter } from './TelemetryReporter';
import { FsmParser } from './FsmParser';
import {
  TrustLevel,
  FinancialEventType,
  TransactionStatus,
  TrustScore,
  FinancialEvent,
  ParsingResult,
  TemplatePlaceholder,
  CompiledTemplate
} from './types';

const DEFAULT_CURRENCY = 'INR';
const CURRENCY_SYMBOL = '₹';
const PARSER_VERSION = '3.0.0';

// Constants for package names
const GPAY_PACKAGE = 'com.google.android.apps.nbu.paisa.user';
const PHONEPE_PACKAGE = 'com.phonepe.app';
const PAYTM_PACKAGE = 'net.one97.paytm';

// Registry of platform-specific templates
const TEMPLATE_REGISTRY: Record<string, { id: string; template: string }[]> = {
  [GPAY_PACKAGE]: [
    { id: 'gpay_paid', template: 'you paid ₹{amount:currency} to {merchant:string}' },
    { id: 'gpay_paid_short', template: 'you paid ₹{amount:currency}' },
    { id: 'gpay_received', template: 'you received ₹{amount:currency} from {merchant:string}' }
  ],
  [PHONEPE_PACKAGE]: [
    { id: 'phonepe_amt_sent_grouped', template: '₹{amount:currency} sent to {merchant:string} UPI Ref: {ref:string} Balance: {balance:string}' },
    { id: 'phonepe_paid_to', template: 'Paid ₹{amount:currency} to {merchant:string}' },
    { id: 'phonepe_sent_to', template: 'Sent ₹{amount:currency} to {merchant:string}' },
    { id: 'phonepe_amt_sent', template: '₹{amount:currency} sent to {merchant:string}' },
    { id: 'phonepe_upi_lite', template: 'UPI LITE: Paid ₹{amount:currency} to {merchant:string}' },
    { id: 'phonepe_received', template: 'Received ₹{amount:currency} from {merchant:string}' }
  ],
  [PAYTM_PACKAGE]: [
    { id: 'paytm_paid_success', template: 'Paid ₹{amount:currency} successfully to {merchant:string} from {wallet:string}' },
    { id: 'paytm_paid_success_short', template: 'Paid ₹{amount:currency} successfully to {merchant:string}' },
    { id: 'paytm_debited', template: '₹{amount:currency} debited from Paytm Wallet' },
    { id: 'paytm_received', template: 'Received ₹{amount:currency} from {merchant:string} into Paytm Wallet' },
    { id: 'paytm_received_short', template: 'Received ₹{amount:currency} from {merchant:string}' },
    { id: 'paytm_credited', template: '₹{amount:currency} credited to your Paytm Wallet' }
  ]
};

// Legacy fallback regexes (safe regex literal immune to backslash compilation traps)
const DEFAULT_AMOUNT_REGEX = /(-?₹-?)\s?([\d,]+(?:\.\d+)?)/;

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

/**
 * Strips emojis, bidirectional controls, variation selectors,
 * and normalizes currencies and whitespaces.
 */
export class FintechInputScrubber {
  static scrub(text: string): string {
    if (!text) return '';

    // Strip Emojis
    let clean = text.replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '');

    // Strip Bidirectional RTL markers & zero-width variation selectors
    clean = clean.replace(/[‎‏‪-‮︎️]/g, '');

    // Standardize currency notation (INR/Rs/NR -> ₹)
    clean = clean.replace(/(\b(INR|Rs|NR|Rupees))\.?\s?:?\s?/gi, CURRENCY_SYMBOL);

    // Safety Healing: Only replace "?" with "₹" if it is contextually followed by a number
    // to prevent converting general punctuation like "Did you pay?" into transaction triggers.
    clean = clean.replace(/\?\s*(\d+)/g, `${CURRENCY_SYMBOL}$1`);

    // Normalize spacing (and replace newlines with single space for grouped alerts)
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
  }
}

/**
 * O(N) Delimiter Scan matching engine (ReDoS-immune)
 */
export class TemplateParser {
  static compile(templateStr: string): CompiledTemplate {
    const staticSegments: string[] = [];
    const placeholders: TemplatePlaceholder[] = [];
    const regex = /\{([^:}]+):([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(templateStr)) !== null) {
      staticSegments.push(templateStr.substring(lastIndex, match.index));
      placeholders.push({
        name: match[1],
        type: match[2] as 'currency' | 'string' | 'account'
      });
      lastIndex = regex.lastIndex;
    }
    staticSegments.push(templateStr.substring(lastIndex));

    return { staticSegments, placeholders };
  }

  /**
   * Calculates template specificity to resolve precedence.
   * Specificity = static characters length + placeholders count * 10
   */
  static getSpecificity(templateStr: string): number {
    const compiled = this.compile(templateStr);
    const staticLen = compiled.staticSegments.reduce((sum, s) => sum + s.length, 0);
    return staticLen + compiled.placeholders.length * 10;
  }

  static match(text: string, template: CompiledTemplate): Record<string, string> | null {
    const values: Record<string, string> = {};
    let currentIndex = 0;
    const lowerText = text.toLowerCase();

    for (let i = 0; i < template.staticSegments.length; i++) {
      const segment = template.staticSegments[i];
      if (segment) {
        const lowerSegment = segment.toLowerCase();
        const foundIndex = lowerText.indexOf(lowerSegment, currentIndex);
        if (foundIndex === -1) return null;

        if (i > 0) {
          const placeholder = template.placeholders[i - 1];
          const val = text.substring(currentIndex, foundIndex).trim();

          // Type Validation: Ensure currency inputs match valid decimal formats
          if (placeholder.type === 'currency') {
            const cleanVal = val.replace(/,/g, '');
            if (!/^\d+(?:\.\d+)?$/.test(cleanVal)) {
              return null; // Invalid amount format, fail template match
            }
          }

          values[placeholder.name] = val;
        }
        currentIndex = foundIndex + segment.length;
      } else {
        if (i > 0 && i === template.staticSegments.length - 1) {
          const placeholder = template.placeholders[i - 1];
          const val = text.substring(currentIndex).trim();

          // Type Validation: Ensure currency inputs match valid decimal formats
          if (placeholder.type === 'currency') {
            const cleanVal = val.replace(/,/g, '');
            if (!/^\d+(?:\.\d+)?$/.test(cleanVal)) {
              return null;
            }
          }

          values[placeholder.name] = val;
        }
      }
    }
    return values;
  }
}

export const UniversalParser = {
  getSmsMetadata: (sourcePackage: string): { brand: string; suffix: string; trust: TrustLevel } => {
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

  normalize: (text: string): string => {
    return FintechInputScrubber.scrub(text);
  },

  isCredit: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('debited') ||
      lowerText.includes('paid') ||
      lowerText.includes('spent') ||
      lowerText.includes('sent') ||
      lowerText.includes('txn')
    ) {
      if (lowerText.includes('credited to') || lowerText.includes('credited with') || lowerText.includes('refund') || lowerText.includes('reversal')) {
        return true;
      }
      return false;
    }

    const CREDIT_KEYWORDS = ['received', 'credited', 'refunded', 'refund', 'reversal', 'cashback', 'returned', 'returned to'];
    return CREDIT_KEYWORDS.some(kw => lowerText.includes(kw));
  },

  extractReferenceId: (text: string): string | null => {
    // UPI ref / transaction reference regexes
    const upiMatch = text.match(/(?:UPI:\s*|Ref\s*|ref\s*no\s*|refno\s*|UPI\s+|Ref\s*no\.?\s*)(\d+)/i);
    return upiMatch ? upiMatch[1] : null;
  },

  extractAccountFingerprint: (text: string): string | null => {
    // Masked account number or card suffix
    const accMatch = text.match(/(?:A\/C\s*|account\s*|card\s*|Card\s*X\s*)(?:\*+|X+|x+)?(\d+)\b/i);
    return accMatch ? accMatch[1] : null;
  },

  extractTimestamp: (text: string): number => {
    // Scan for transactional timestamps (e.g. on 15-May-26 or 13-05-2026)
    const dateMatch = text.match(/on\s+(\d+[-/]\w+[-/]\d+|\d+[-/]\d+[-/]\d+)/i);
    if (dateMatch) {
      const parsed = Date.parse(dateMatch[1]);
      if (!isNaN(parsed)) return parsed;
    }
    return Date.now();
  },

  parse: (text: string, sourcePackage: string = 'app'): ParsingResult | null => {
    if (!text) return null;

    TelemetryReporter.logScan();

    // 1. Promo & Spam Filter (Tier 0 Gate)
    // Discard any promotional alerts or scam URL messages early
    if (UniversalParser.isPromotional(text, sourcePackage)) {
      TelemetryReporter.logAnomaly(text, 'Discarded promotional/spam alert');
      return null;
    }

    if (sourcePackage.startsWith('sms:')) {
      const metadata = UniversalParser.getSmsMetadata(sourcePackage);
      if (metadata.suffix === 'P') {
        TelemetryReporter.logAnomaly(text, 'Discarded promotional SMS suffix P');
        return null;
      }
    }

    const lowerText = text.toLowerCase();
    if (NON_TRANSACTION_KEYWORDS.some(kw => lowerText.includes(kw))) {
      return null;
    }

    const normalizedText = UniversalParser.normalize(text);
    const metadata = UniversalParser.getSmsMetadata(sourcePackage);

    // 2. Structured Trust Score Routing
    let trustScore: TrustScore = 'MEDIUM';
    if (sourcePackage.startsWith('sms:')) {
      trustScore = metadata.trust === 'VERIFIED' ? 'HIGH' : 'LOW';
    } else if ([GPAY_PACKAGE, PHONEPE_PACKAGE, PAYTM_PACKAGE].includes(sourcePackage)) {
      trustScore = 'VERY_HIGH';
    }

    let events: FinancialEvent[] = [];
    let templateId: string | null = null;
    let baseConfidence = 0.75;
    let tier = 3;

    // Extract reference and account fingerprints
    const referenceId = UniversalParser.extractReferenceId(normalizedText);
    const accountFingerprint = UniversalParser.extractAccountFingerprint(normalizedText);
    const timestamp = UniversalParser.extractTimestamp(normalizedText);

    // 3. Declarative Template Matcher with Precedence Resolution (Tier 2)
    if (sourcePackage && sourcePackage !== 'app' && TEMPLATE_REGISTRY[sourcePackage]) {
      const templates = TEMPLATE_REGISTRY[sourcePackage];

      // Precedence Engine: Sort templates by specificity score descending
      const sortedTemplates = [...templates].sort((a, b) => {
        return TemplateParser.getSpecificity(b.template) - TemplateParser.getSpecificity(a.template);
      });

      for (const t of sortedTemplates) {
        const compiled = TemplateParser.compile(t.template);
        const match = TemplateParser.match(normalizedText, compiled);
        if (match) {
          const rawAmount = match.amount ? parseFloat(match.amount.replace(/,/g, '')) : 0;
          let amountPaise = Math.round(rawAmount * 100);
          const isCredit = UniversalParser.isCredit(normalizedText);

          if (isCredit) {
            amountPaise = -Math.abs(amountPaise);
          } else {
            amountPaise = Math.abs(amountPaise);
          }

          // Map reversals/refund status
          const isReversal = normalizedText.toLowerCase().includes('reversal') || normalizedText.toLowerCase().includes('refund');
          const status: TransactionStatus = isReversal ? 'reversal' : 'success';
          const type: FinancialEventType = isCredit
            ? (normalizedText.toLowerCase().includes('cashback') ? 'cashback' : 'credit')
            : 'debit';

          events.push({
            type,
            amountPaise,
            currency: DEFAULT_CURRENCY,
            merchantName: match.merchant || null,
            status,
            trustScore,
            rawSegment: normalizedText,
            parserVersion: PARSER_VERSION,
            templateId: t.id,
            tier: 2,
            referenceId,
            accountFingerprint
          });

          templateId = t.id;
          baseConfidence = 0.95;
          tier = 2;
          break;
        }
      }
    }

    // 4. Tokenizer FSM Fallback Engine (Tier 3)
    if (events.length === 0) {
      const fsmRes = FsmParser.parse(normalizedText);
      if (fsmRes) {
        const isReversal = normalizedText.toLowerCase().includes('reversal') || normalizedText.toLowerCase().includes('refund');
        const status: TransactionStatus = isReversal ? 'reversal' : fsmRes.status;

        events.push({
          type: fsmRes.type,
          amountPaise: fsmRes.amountPaise,
          currency: DEFAULT_CURRENCY,
          merchantName: fsmRes.merchantName,
          status,
          trustScore,
          rawSegment: normalizedText,
          parserVersion: PARSER_VERSION,
          templateId: null,
          tier: 3,
          referenceId,
          accountFingerprint
        });
        baseConfidence = 0.75;
        tier = 3;
      }
    }

    // Default Fallback Regex Matcher (Tier 3 fallback when FSM fails due to spacing/token splits)
    if (events.length === 0) {
      let match = normalizedText.match(DEFAULT_AMOUNT_REGEX);
      if (!match) {
        const isBankSms = /a\/c|acct|account|bank|ref\s*no|refno|trf|upi/i.test(normalizedText);
        if (isBankSms) {
          for (const pattern of NO_SYMBOL_PATTERNS) {
            const noSymbolMatch = normalizedText.match(pattern);
            if (noSymbolMatch) {
              match = [noSymbolMatch[0], CURRENCY_SYMBOL, noSymbolMatch[1]] as RegExpMatchArray;
              break;
            }
          }
        }
      }

      if (match) {
        const result = UniversalParser.extractFromMatch(match, normalizedText, metadata.trust);
        if (result) {
          const type: FinancialEventType = UniversalParser.isCredit(normalizedText) ? 'credit' : 'debit';
          events.push({
            type,
            amountPaise: result.amountPaise,
            currency: result.currency,
            merchantName: null,
            status: 'success',
            trustScore: 'MEDIUM',
            rawSegment: normalizedText,
            parserVersion: PARSER_VERSION,
            templateId: null,
            tier: 3,
            referenceId,
            accountFingerprint
          });
          baseConfidence = 0.75;
          tier = 3;
        }
      }
    }

    // 5. Double intent extraction: Cashback matches inside debit alerts
    if (events.length > 0 && events[0].type === 'debit') {
      const lowerScrubbed = normalizedText.toLowerCase();
      const cashbackMatch = lowerScrubbed.match(/(?:cashback|won|credited)\s*(?:of\s*)?₹\s*([\d,]+(?:\.\d+)?)/i);
      if (cashbackMatch) {
        const cbAmount = Math.round(parseFloat(cashbackMatch[1].replace(/,/g, '')) * 100);
        events.push({
          type: 'cashback',
          amountPaise: -cbAmount,
          currency: DEFAULT_CURRENCY,
          merchantName: events[0].merchantName,
          status: 'success',
          trustScore,
          rawSegment: cashbackMatch[0],
          parserVersion: PARSER_VERSION,
          templateId: null,
          tier,
          referenceId,
          accountFingerprint
        });
      }
    }

    if (events.length === 0) {
      TelemetryReporter.logFailure();
      TelemetryReporter.logAnomaly(text, 'Failed to extract any financial event');
      return null;
    }

    // Bounded Sliding Deduplication check - ONLY for real non-test/non-manual alerts (preserves fuzzer runs)
    const primaryEvent = events[0];
    if (sourcePackage && sourcePackage !== 'app') {
      const isDup = Deduplicator.isDuplicate(
        normalizedText,
        primaryEvent.merchantName,
        timestamp,
        primaryEvent.amountPaise,
        referenceId,
        accountFingerprint,
        primaryEvent.status
      );
      if (isDup) {
        return null;
      }
    }

    // Confidence Calculation
    let confidence = baseConfidence;
    if (!primaryEvent.merchantName) {
      confidence -= 0.1;
    }
    if (!normalizedText.includes(CURRENCY_SYMBOL) && !normalizedText.includes('INR')) {
      confidence -= 0.2;
    }
    confidence = Math.max(0.1, Math.min(0.99, confidence));

    TelemetryReporter.logParse(templateId);

    return {
      amountPaise: primaryEvent.amountPaise,
      currency: primaryEvent.currency,
      trustLevel: metadata.trust,
      events,
      parserVersion: PARSER_VERSION,
      templateId,
      confidence,
      timestamp,
      rawText: text,
      sourcePackage,
      referenceId,
      accountFingerprint
    };
  },

  extractFromMatch: (match: RegExpMatchArray, originalText: string, trustLevel: TrustLevel) => {
    const symbolPart = match[1];
    const hasNegativeSign = symbolPart.includes('-');
    const isCredit = UniversalParser.isCredit(originalText);

    const rawAmount = parseFloat(match[2].replace(/,/g, ''));
    let amountPaise = Math.round(rawAmount * 100);

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

  isPromotional: (text: string, sourcePackage: string = 'app'): boolean => {
    if (sourcePackage.startsWith('sms:')) {
      const metadata = UniversalParser.getSmsMetadata(sourcePackage);
      if (metadata.suffix === 'P') return true;
    }

    const lowerText = text.toLowerCase();

    // Spam URL Security check
    // If the message contains arbitrary HTTP/HTTPS links (not matching standard bank portals),
    // immediately treat as spam/promotional to prevent phishing.
    if (/https?:\/\/(?!.*\b(?:icicibank|hdfcbank|sbi|paytm|phonepe)\.com\b)[^\s]+/i.test(lowerText)) {
      return true;
    }

    const PROMO_KEYWORDS = ["offer", "reward", "cashback", "win", "discount", "congratulations"];
    // Exclude actual transaction confirmations containing "cashback"
    if (lowerText.includes('paid') || lowerText.includes('debited') || lowerText.includes('received') || lowerText.includes('credited') || (lowerText.includes('won') && lowerText.includes('cashback'))) {
      return false;
    }
    return PROMO_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }
};
