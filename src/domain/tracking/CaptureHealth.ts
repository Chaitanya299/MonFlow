import { NativeModules } from 'react-native';

const { MonfloBridge } = NativeModules;

export type GapReason = 'BACKGROUND_SUPPRESSED' | 'ACCESS_REVOKED' | string;

export interface CaptureGap {
  startMs: number;
  endMs: number;
  reason: GapReason;
  acknowledged: boolean;
}

export interface CaptureHealthSnapshot {
  lastAliveMs: number;
  lastListenerConnectedMs: number;
  accessGranted: boolean;
  gaps: CaptureGap[];
}

const formatTime = (ms: number): string => {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m}${ampm}`;
};

/**
 * Builds the user-facing banner/notification text from unacknowledged gaps. Pure + testable.
 * Returns null when there is nothing to warn about.
 */
export const formatGapMessage = (gaps: CaptureGap[]): string | null => {
  const unacked = gaps.filter((g) => !g.acknowledged);
  if (unacked.length === 0) return null;

  if (unacked.some((g) => g.reason === 'ACCESS_REVOKED')) {
    return 'Capture is off — notification access was turned off. Some transactions may be missing.';
  }

  // Most recent suppression window.
  const latest = unacked.reduce((a, b) => (b.endMs > a.endMs ? b : a));
  return `Capture paused ${formatTime(latest.startMs)}–${formatTime(
    latest.endMs
  )} — some transactions may be missing, check manually.`;
};

/** True when an unacknowledged gap is due to revoked notification access (CTA should open settings). */
export const needsAccessFix = (gaps: CaptureGap[]): boolean =>
  gaps.some((g) => !g.acknowledged && g.reason === 'ACCESS_REVOKED');

export const getCaptureHealth = async (): Promise<CaptureHealthSnapshot | null> => {
  if (!MonfloBridge?.getCaptureHealth) return null;
  try {
    return await MonfloBridge.getCaptureHealth();
  } catch {
    return null;
  }
};

export const acknowledgeCaptureGaps = async (): Promise<void> => {
  if (!MonfloBridge?.acknowledgeCaptureGaps) return;
  try {
    await MonfloBridge.acknowledgeCaptureGaps();
  } catch {
    // best-effort
  }
};

export const openNotificationAccessSettings = (): void => {
  MonfloBridge?.openNotificationAccessSettings?.();
};
