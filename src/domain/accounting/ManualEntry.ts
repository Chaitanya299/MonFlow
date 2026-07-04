import { ProcessedTransaction, TransactionCategory } from './types';

/**
 * Manual (user-entered) transactions: cash wallet + general manual entries.
 * Reuses the existing ProcessedTransaction model and saveTransaction bridge —
 * no native changes. Discriminated by sourcePackage: 'cash' | 'manual'.
 *
 * Sign convention (matches parser + getDailySummary): positive amountPaise = money
 * out (spend/expense), negative = money in (income/top-up).
 */

export type ManualSource = 'cash' | 'manual';

export interface ManualEntryInput {
  amountRupees: string | number; // raw user input
  direction: 'out' | 'in'; // out = spend/expense, in = top-up/income
  category: TransactionCategory;
  note?: string;
  sourcePackage: ManualSource;
  timestamp?: number;
  id?: string; // set when editing — save replaces the row with this id
}

// ₹10 crore ceiling — well inside Number.MAX_SAFE_INTEGER paise, blocks fat-finger overflow.
const MAX_PAISE = 100_000_000_000;

/** Parse + validate a user-entered rupee amount into positive paise. Throws on invalid input. */
export function toPaise(amountRupees: string | number): number {
  const rupees = typeof amountRupees === 'string' ? parseFloat(amountRupees.trim()) : amountRupees;
  if (!Number.isFinite(rupees) || rupees <= 0) {
    throw new Error('Enter a valid amount greater than 0');
  }
  const paise = Math.round(rupees * 100);
  if (paise <= 0 || paise > MAX_PAISE) {
    throw new Error('Amount is out of range');
  }
  return paise;
}

export function buildManualTransaction(input: ManualEntryInput): ProcessedTransaction {
  const paise = toPaise(input.amountRupees);
  const signed = input.direction === 'out' ? paise : -paise;
  const ts = input.timestamp ?? Date.now();
  const note = input.note?.trim();
  const isCash = input.sourcePackage === 'cash';
  const fallback = isCash
    ? input.direction === 'in' ? 'Cash top-up' : 'Cash spend'
    : input.direction === 'in' ? 'Manual income' : 'Manual expense';

  return {
    id: input.id ?? `tx_${ts}_${Math.random().toString(36).slice(2, 8)}`, // ponytail: local DB key, non-crypto id is fine
    amountPaise: signed,
    currency: 'INR',
    merchantName: note || fallback,
    category: input.category,
    tags: [],
    sourcePackage: input.sourcePackage,
    rawText: `Manual entry: ${note || fallback}`,
    timestamp: ts,
    isSplit: false,
    splitGroupId: null,
    trustLevel: 'VERIFIED', // user-entered = real, not a scam-risk alert
  };
}

export interface CashWallet {
  balancePaise: number; // top-ups minus spends
  todaySpentPaise: number;
}

/** Cash-on-hand from all cash transactions. Balance = -(sum of amountPaise). */
export function computeCashWallet(cashTxns: ProcessedTransaction[], now: number = Date.now()): CashWallet {
  const today = new Date(now).toDateString();
  let net = 0;
  let todaySpent = 0;
  for (const tx of cashTxns) {
    net += tx.amountPaise;
    if (tx.amountPaise > 0 && new Date(tx.timestamp).toDateString() === today) {
      todaySpent += tx.amountPaise;
    }
  }
  return { balancePaise: -net || 0, todaySpentPaise: todaySpent };
}
