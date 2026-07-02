import { describe, it, expect, vi } from 'vitest';

// InviteManager imports react-native (Linking) transitively; stub it for node.
vi.mock('react-native', () => ({
  Linking: { getInitialURL: () => Promise.resolve(null), addEventListener: () => ({ remove() {} }) },
  NativeModules: { MonfloBridge: {} },
}));

import {
  InviteManager,
  InvitePayload,
  bytesToBase64,
  base64ToBytes,
} from '../../../src/domain/social/InviteManager';

const makeLink = (overrides: Partial<InvitePayload>): string => {
  const payload: InvitePayload = {
    groupId: 'grp_abc',
    creatorPubKey: 'pk',
    creatorName: 'Alice',
    sharedSecret: bytesToBase64(new Uint8Array(32).fill(7)),
    ...overrides,
  };
  return `monflo://invite?data=${btoa(JSON.stringify(payload))}`;
};

describe('InviteManager — secret transport', () => {
  it('round-trips a real 32-byte secret through the link', () => {
    const secret = new Uint8Array(32).map((_, i) => i);
    const parsed = InviteManager.parseInviteLink(makeLink({ sharedSecret: bytesToBase64(secret) }));
    expect(parsed).not.toBeNull();
    expect(Array.from(base64ToBytes(parsed!.sharedSecret))).toEqual(Array.from(secret));
  });

  it('rejects a link with no secret (untrusted-input guard)', () => {
    const bad = `monflo://invite?data=${btoa(JSON.stringify({ groupId: 'g', creatorPubKey: 'p', creatorName: 'n' }))}`;
    expect(InviteManager.parseInviteLink(bad)).toBeNull();
  });

  it('rejects a link whose secret is not 32 bytes', () => {
    expect(InviteManager.parseInviteLink(makeLink({ sharedSecret: bytesToBase64(new Uint8Array(16)) }))).toBeNull();
  });

  it('never accepts the old hardcoded 0x01x32 placeholder as a valid distinct key', () => {
    // Regression: the old join path used a constant key. The secret must now
    // come from the link, so a real random secret must survive the round-trip
    // unchanged (i.e. not be silently replaced by a constant).
    const real = new Uint8Array(32).fill(42);
    const parsed = InviteManager.parseInviteLink(makeLink({ sharedSecret: bytesToBase64(real) }));
    expect(base64ToBytes(parsed!.sharedSecret)).not.toEqual(new Uint8Array(32).fill(1));
    expect(base64ToBytes(parsed!.sharedSecret)).toEqual(real);
  });
});
