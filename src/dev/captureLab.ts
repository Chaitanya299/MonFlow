import { ProcessedTransaction } from '../domain/accounting/types';

/**
 * Dev-only "Capture Lab" support: the 4 test modes and pure formatters for
 * exporting every captured transaction so parser behavior can be reviewed by hand.
 * Kept out of release by living under src/dev (gated behind __DEV__ at the screen).
 */

export type CaptureModeId =
  | 'NOTIF_ONLY'
  | 'ALL'
  | 'BANK_SMS_NOTIF_ONLY'
  | 'SMS_RECEIVER_ONLY';

export interface CaptureModeInfo {
  id: CaptureModeId;
  label: string;
  desc: string;
}

// Mirrors CaptureConfig.kt. Order = display order in the selector.
export const CAPTURE_MODES: CaptureModeInfo[] = [
  { id: 'NOTIF_ONLY', label: 'Notification listener only', desc: 'UPI + app notifications (no SMS)' },
  { id: 'BANK_SMS_NOTIF_ONLY', label: 'Bank SMS via Messages', desc: 'SMS read from the Messages app notification' },
  { id: 'SMS_RECEIVER_ONLY', label: 'SMS receiver only', desc: 'Direct SMS broadcast (sideload build)' },
  { id: 'ALL', label: 'All 3 sources', desc: 'Everything on (production default)' },
];

const UNPARSED_TAG = 'unparsed';

export function wasParsed(tx: ProcessedTransaction): boolean {
  return !(tx.tags || []).includes(UNPARSED_TAG);
}

export function captureSource(tx: ProcessedTransaction): 'SMS' | 'APP' {
  return tx.sourcePackage.startsWith('sms:') ? 'SMS' : 'APP';
}

function csvCell(value: string | number): string {
  const s = String(value ?? '').replace(/[\r\n]+/g, ' ');
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * One row per captured transaction, newest first. Columns are ordered so the
 * input (rawText) sits next to what the parser produced from it.
 */
export function formatCapturesCsv(txs: ProcessedTransaction[]): string {
  const header = [
    'datetime', 'source', 'sourcePackage', 'parsed',
    'amountRs', 'merchant', 'category', 'trustLevel', 'rawText',
  ].join(',');

  const rows = [...txs]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((tx) => [
      csvCell(new Date(tx.timestamp).toISOString()),
      csvCell(captureSource(tx)),
      csvCell(tx.sourcePackage),
      csvCell(wasParsed(tx) ? 'yes' : 'no'),
      csvCell((tx.amountPaise / 100).toFixed(2)),
      csvCell(tx.merchantName ?? ''),
      csvCell(tx.category),
      csvCell(tx.trustLevel),
      csvCell(tx.rawText),
    ].join(','));

  return [header, ...rows].join('\n');
}

export interface CaptureSummary {
  total: number;
  parsed: number;
  unparsed: number;
  fromApp: number;
  fromSms: number;
  parseRate: number; // 0..1
}

export function summarizeCaptures(txs: ProcessedTransaction[]): CaptureSummary {
  const total = txs.length;
  const parsed = txs.filter(wasParsed).length;
  const fromSms = txs.filter((t) => captureSource(t) === 'SMS').length;
  return {
    total,
    parsed,
    unparsed: total - parsed,
    fromApp: total - fromSms,
    fromSms,
    parseRate: total === 0 ? 0 : parsed / total,
  };
}
