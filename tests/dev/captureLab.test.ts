import { describe, it, expect } from 'vitest';
import {
  formatCapturesCsv,
  summarizeCaptures,
  captureSource,
  wasParsed,
  CAPTURE_MODES,
} from '../../src/dev/captureLab';
import { ProcessedTransaction } from '../../src/domain/accounting/types';

const tx = (over: Partial<ProcessedTransaction>): ProcessedTransaction => ({
  id: 'x',
  amountPaise: 15000,
  currency: 'INR',
  merchantName: 'Swiggy',
  category: 'food',
  tags: [],
  sourcePackage: 'com.phonepe.app',
  rawText: 'Paid ₹150 to Swiggy',
  timestamp: 1000,
  isSplit: false,
  splitGroupId: null,
  trustLevel: 'VERIFIED',
  ...over,
});

describe('captureLab', () => {
  it('exposes exactly the 4 test modes', () => {
    expect(CAPTURE_MODES.map((m) => m.id).sort()).toEqual(
      ['ALL', 'BANK_SMS_NOTIF_ONLY', 'NOTIF_ONLY', 'SMS_RECEIVER_ONLY']
    );
  });

  it('classifies capture source by sms: prefix', () => {
    expect(captureSource(tx({ sourcePackage: 'com.phonepe.app' }))).toBe('APP');
    expect(captureSource(tx({ sourcePackage: 'sms:VM-HDFCBK-S' }))).toBe('SMS');
  });

  it('treats the unparsed tag as a parser miss', () => {
    expect(wasParsed(tx({ tags: [] }))).toBe(true);
    expect(wasParsed(tx({ tags: ['unparsed'] }))).toBe(false);
  });

  it('summarizes counts and hit rate', () => {
    const s = summarizeCaptures([
      tx({ tags: [] }),
      tx({ tags: ['unparsed'], sourcePackage: 'sms:VM-HDFCBK-S' }),
    ]);
    expect(s).toMatchObject({ total: 2, parsed: 1, unparsed: 1, fromApp: 1, fromSms: 1 });
    expect(s.parseRate).toBeCloseTo(0.5);
  });

  it('formats CSV newest-first with a header row', () => {
    const csv = formatCapturesCsv([
      tx({ id: 'a', timestamp: 1000 }),
      tx({ id: 'b', timestamp: 2000 }),
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('datetime,source,sourcePackage,parsed');
    // newest (timestamp 2000) first
    expect(lines[1]).toContain('2.00'); // amountRs 150.00 -> escaped cell
    expect(lines).toHaveLength(3);
  });

  it('escapes commas, quotes and newlines in rawText', () => {
    const csv = formatCapturesCsv([
      tx({ rawText: 'Paid ₹1,500 to "Cafe",\nUPI Ref 99' }),
    ]);
    const row = csv.split('\n')[1];
    // internal quotes doubled, no stray newline breaking the row
    expect(row).toContain('""Cafe""');
    expect(csv.split('\n')).toHaveLength(2);
  });

  it('marks unparsed rows as parsed=no with zero amount', () => {
    const csv = formatCapturesCsv([
      tx({ amountPaise: 0, tags: ['unparsed'], merchantName: null, category: 'untagged' }),
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"no"');
    expect(row).toContain('"0.00"');
    expect(row).toContain('"untagged"');
  });
});
