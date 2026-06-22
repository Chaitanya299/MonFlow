import { FinancialEventType, TransactionStatus } from './types';

export interface FsmResult {
  amountPaise: number;
  type: FinancialEventType;
  status: TransactionStatus;
  merchantName: string | null;
  tracing: string[];
}

type ParserState = 'INIT' | 'DEBIT' | 'CREDIT' | 'AMOUNT_FOUND' | 'STATUS_FOUND' | 'MERCHANT_LOOKUP';

export class FsmParser {
  private static DEBIT_KEYWORDS = new Set([
    'paid', 'sent', 'debited', 'spent', 'transferred', 'charged', 'authorized',
    'bheja', 'nikale', 'kharch', 'kata' // Common transliterated Hindi/Hinglish debit keywords
  ]);

  private static CREDIT_KEYWORDS = new Set([
    'received', 'credited', 'refunded', 'reversal', 'returned', 'refund', 'mila',
    'jama', 'prapt', 'swikar', 'won', 'cashback' // Common transliterated Hindi/Hinglish credit keywords
  ]);

  private static STATUS_KEYWORDS: Record<string, TransactionStatus> = {
    'initiated': 'initiated',
    'processing': 'processing',
    'pending': 'pending',
    'successfully': 'success',
    'success': 'success',
    'failed': 'failed',
    'declined': 'failed',
    'reversal': 'reversal'
  };

  private static TERMINAL_TOKENS = new Set([
    'via', 'upi', 'ref', 'refno', 'on', 'balance', 'bal', 'avl', 'avlbl', 'limit', 'lmt', 'a/c', 'acct', 'account'
  ]);

  /**
   * Safe linear-time Tokenizer FSM.
   * Processes raw string sequentially to extract amount, type, status, and merchant.
   * Tracks full state transition tracing for complete observability.
   */
  static parse(text: string): FsmResult | null {
    const rawTokens = text.split(/\s+/);
    const tracing: string[] = ['INIT'];

    let state: ParserState = 'INIT';
    let amountPaise = 0;
    let type: FinancialEventType = 'unknown';
    let status: TransactionStatus = 'success'; // Default status
    const merchantTokens: string[] = [];
    let nextIsMerchant = false;

    for (let i = 0; i < rawTokens.length; i++) {
      const rawToken = rawTokens[i];
      const token = rawToken.toLowerCase().replace(/[,:;()]/g, '');

      if (!token) continue;

      // Extract debit/credit type dynamically at any point to resolve word order issues
      if (type === 'unknown') {
        if (this.DEBIT_KEYWORDS.has(token)) {
          type = 'debit';
          tracing.push(`TYPE_DETERMINED(debit)`);
        } else if (this.CREDIT_KEYWORDS.has(token)) {
          type = 'credit';
          tracing.push(`TYPE_DETERMINED(credit)`);
        }
      }

      // Transition Table Evaluation
      switch (state) {
        case 'INIT':
          if (this.DEBIT_KEYWORDS.has(token)) {
            state = 'DEBIT';
            tracing.push('DEBIT');
          } else if (this.CREDIT_KEYWORDS.has(token)) {
            state = 'CREDIT';
            tracing.push('CREDIT');
          } else if (token.includes('₹')) {
            const parsedAmount = this.extractNumber(token);
            if (parsedAmount !== null) {
              amountPaise = parsedAmount;
              state = 'AMOUNT_FOUND';
              tracing.push(`AMOUNT_FOUND(${amountPaise})`);
            }
          }
          break;

        case 'DEBIT':
        case 'CREDIT':
          if (token.includes('₹')) {
            const parsedAmount = this.extractNumber(token);
            if (parsedAmount !== null) {
              amountPaise = parsedAmount;
              state = 'AMOUNT_FOUND';
              tracing.push(`AMOUNT_FOUND(${amountPaise})`);
            }
          } else if (token === 'to' || token === 'from' || token === 'by') {
            state = 'MERCHANT_LOOKUP';
            nextIsMerchant = true;
            tracing.push('MERCHANT_LOOKUP');
          }
          break;

        case 'AMOUNT_FOUND':
          if (this.STATUS_KEYWORDS[token]) {
            status = this.STATUS_KEYWORDS[token];
            state = 'STATUS_FOUND';
            tracing.push(`STATUS_FOUND(${status})`);
          } else if (token === 'to' || token === 'from' || token === 'by') {
            state = 'MERCHANT_LOOKUP';
            nextIsMerchant = true;
            tracing.push('MERCHANT_LOOKUP');
          }
          break;

        case 'MERCHANT_LOOKUP':
          if (nextIsMerchant) {
            // Stop accumulating merchant tokens if we hit a terminal marker or punctuation
            const cleanToken = rawToken.replace(/[.,:;()]/g, '');
            if (
              this.TERMINAL_TOKENS.has(token) ||
              this.DEBIT_KEYWORDS.has(token) ||
              this.CREDIT_KEYWORDS.has(token) ||
              /^\d+$/.test(cleanToken) || // Skip transaction IDs/numbers
              /^[.,:;()]+$/.test(rawToken)
            ) {
              nextIsMerchant = false;
              tracing.push(`MERCHANT_STOP(${merchantTokens.join(' ')})`);
            } else {
              merchantTokens.push(rawToken.replace(/[.,:;()]/g, ''));
            }
          }
          break;

        case 'STATUS_FOUND':
          if (token === 'to' || token === 'from') {
            state = 'MERCHANT_LOOKUP';
            nextIsMerchant = true;
            tracing.push('MERCHANT_LOOKUP');
          }
          break;
      }
    }

    if (amountPaise === 0) {
      // Emergency Sweep: If amount was not extracted, search for any numeric token adjacent to currency markers
      for (const t of rawTokens) {
        if (t.includes('₹') || t.toLowerCase().includes('rs') || t.toLowerCase().includes('inr')) {
          const val = this.extractNumber(t);
          if (val !== null) {
            amountPaise = val;
            tracing.push(`EMERGENCY_SWEEP_AMOUNT(${amountPaise})`);
            break;
          }
        }
      }
    }

    if (amountPaise === 0 && state !== 'AMOUNT_FOUND' && !tracing.some(t => t.startsWith('EMERGENCY_SWEEP_AMOUNT'))) {
      return null;
    }

    // Map reversals/refunds directly
    if (type === 'credit') {
      amountPaise = -Math.abs(amountPaise);
    } else if (type === 'debit') {
      amountPaise = Math.abs(amountPaise);
    }

    const merchantName = merchantTokens.length > 0 ? merchantTokens.join(' ').trim() : null;

    return {
      amountPaise,
      type,
      status,
      merchantName,
      tracing
    };
  }

  private static extractNumber(token: string): number | null {
    const cleanNum = token.replace(/[^0-9.]/g, '');
    const val = parseFloat(cleanNum);
    return isNaN(val) ? null : Math.round(val * 100);
  }
}
