import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: {
      getCaptureHealth: vi.fn(),
      acknowledgeCaptureGaps: vi.fn(),
      openNotificationAccessSettings: vi.fn(),
    },
  },
}));

import { formatGapMessage, needsAccessFix, CaptureGap } from '../../../src/domain/tracking/CaptureHealth';

// Build times via the LOCAL Date constructor so local getHours() round-trips regardless of TZ.
const at = (h: number, m: number) => new Date(2024, 0, 1, h, m, 0, 0).getTime();

const gap = (over: Partial<CaptureGap>): CaptureGap => ({
  startMs: at(14, 14),
  endMs: at(16, 48),
  reason: 'BACKGROUND_SUPPRESSED',
  acknowledged: false,
  ...over,
});

describe('CaptureHealth — formatGapMessage', () => {
  it('returns null when there are no gaps', () => {
    expect(formatGapMessage([])).toBeNull();
  });

  it('returns null when every gap is acknowledged', () => {
    expect(formatGapMessage([gap({ acknowledged: true })])).toBeNull();
  });

  it('formats the suppression window for an unacknowledged gap', () => {
    const msg = formatGapMessage([gap({})]);
    expect(msg).toContain('2:14pm');
    expect(msg).toContain('4:48pm');
    expect(msg).toContain('check manually');
  });

  it('uses the most recent unacknowledged window when several exist', () => {
    const msg = formatGapMessage([
      gap({ startMs: at(2, 0), endMs: at(3, 0) }),
      gap({ startMs: at(9, 5), endMs: at(11, 30) }),
    ]);
    expect(msg).toContain('9:05am');
    expect(msg).toContain('11:30am');
  });

  it('prioritizes the access-revoked message over a suppression window', () => {
    const msg = formatGapMessage([
      gap({}),
      gap({ reason: 'ACCESS_REVOKED' }),
    ]);
    expect(msg).toContain('notification access was turned off');
  });
});

describe('CaptureHealth — needsAccessFix', () => {
  it('is true only for an unacknowledged access-revoked gap', () => {
    expect(needsAccessFix([gap({ reason: 'ACCESS_REVOKED' })])).toBe(true);
    expect(needsAccessFix([gap({ reason: 'ACCESS_REVOKED', acknowledged: true })])).toBe(false);
    expect(needsAccessFix([gap({})])).toBe(false);
    expect(needsAccessFix([])).toBe(false);
  });
});
