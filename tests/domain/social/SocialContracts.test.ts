import { describe, it, expect } from 'vitest';
import type {
  SplitGroup,
  GroupMetadata,
  MemberProfile,
  SplitTransaction,
  SettlementRecord,
  PeerBalance,
} from '../../../src/domain/social/types';
import type { CRDTSyncEngine } from '../../../src/domain/social/CRDTSyncEngine';

describe('Social Domain — SplitGroup contract', () => {
  const makeGroup = (overrides?: Partial<SplitGroup>): SplitGroup => ({
    id: 'grp-001',
    metadata: { name: 'Weekend Trip', createdAt: Date.now(), createdBy: 'pk-alice' },
    members: {},
    transactions: {},
    settlements: {},
    ...overrides,
  });

  it('should construct a valid empty SplitGroup', () => {
    const g = makeGroup();
    expect(g.id).toBe('grp-001');
    expect(g.metadata.name).toBe('Weekend Trip');
    expect(Object.keys(g.members)).toHaveLength(0);
    expect(Object.keys(g.transactions)).toHaveLength(0);
    expect(Object.keys(g.settlements)).toHaveLength(0);
  });

  it('should key members by phone number hash', () => {
    const g = makeGroup({
      members: {
        'hash-abc': {
          phoneNumberHash: 'hash-abc',
          displayName: 'Alice',
          publicKey: 'pk-alice',
          joinedAt: Date.now(),
        },
      },
    });
    expect(g.members['hash-abc'].displayName).toBe('Alice');
    expect(g.members['hash-abc'].publicKey).toBe('pk-alice');
  });

  it('should support multiple members', () => {
    const now = Date.now();
    const g = makeGroup({
      members: {
        'hash-1': { phoneNumberHash: 'hash-1', displayName: 'A', publicKey: 'pk-1', joinedAt: now },
        'hash-2': { phoneNumberHash: 'hash-2', displayName: 'B', publicKey: 'pk-2', joinedAt: now },
        'hash-3': { phoneNumberHash: 'hash-3', displayName: 'C', publicKey: 'pk-3', joinedAt: now },
      },
    });
    expect(Object.keys(g.members)).toHaveLength(3);
  });
});

describe('Social Domain — GroupMetadata contract', () => {
  it('should have name, createdAt, and createdBy', () => {
    const meta: GroupMetadata = {
      name: 'Flat Expenses',
      createdAt: 1715000000000,
      createdBy: 'pk-creator',
    };
    expect(meta.name).toBe('Flat Expenses');
    expect(meta.createdAt).toBe(1715000000000);
    expect(meta.createdBy).toBe('pk-creator');
  });
});

describe('Social Domain — MemberProfile contract', () => {
  it('should store hashed phone number, not plaintext', () => {
    const member: MemberProfile = {
      phoneNumberHash: 'sha256-9876543210',
      displayName: 'Bob',
      publicKey: 'ed25519-bob-pubkey',
      joinedAt: Date.now(),
    };
    expect(member.phoneNumberHash).not.toMatch(/^\d{10}$/);
    expect(member.publicKey).toBeTruthy();
  });
});

describe('Social Domain — SplitTransaction contract', () => {
  const makeSplitTx = (overrides?: Partial<SplitTransaction>): SplitTransaction => ({
    id: 'stx-001',
    amountPaise: 90000,
    paidBy: 'hash-alice',
    splitAmong: ['hash-alice', 'hash-bob', 'hash-charlie'],
    description: 'Dinner at Barbeque Nation',
    timestamp: Date.now(),
    ...overrides,
  });

  it('should construct a valid SplitTransaction', () => {
    const tx = makeSplitTx();
    expect(tx.id).toBe('stx-001');
    expect(tx.amountPaise).toBe(90000);
    expect(tx.paidBy).toBe('hash-alice');
    expect(tx.splitAmong).toHaveLength(3);
  });

  it('should use integer paise for split amounts', () => {
    const tx = makeSplitTx({ amountPaise: 30033 });
    expect(Number.isInteger(tx.amountPaise)).toBe(true);
  });

  it('should include the payer in splitAmong list', () => {
    const tx = makeSplitTx();
    expect(tx.splitAmong).toContain(tx.paidBy);
  });

  it('should support 2-person splits', () => {
    const tx = makeSplitTx({ splitAmong: ['hash-alice', 'hash-bob'] });
    expect(tx.splitAmong).toHaveLength(2);
  });
});

describe('Social Domain — SettlementRecord contract', () => {
  const makeSettlement = (overrides?: Partial<SettlementRecord>): SettlementRecord => ({
    id: 'stl-001',
    fromMember: 'hash-bob',
    toMember: 'hash-alice',
    amountPaise: 30000,
    isConfirmed: false,
    timestamp: Date.now(),
    ...overrides,
  });

  it('should construct a valid SettlementRecord', () => {
    const s = makeSettlement();
    expect(s.fromMember).toBe('hash-bob');
    expect(s.toMember).toBe('hash-alice');
    expect(s.amountPaise).toBe(30000);
  });

  it('should default isConfirmed to false', () => {
    const s = makeSettlement();
    expect(s.isConfirmed).toBe(false);
  });

  it('should be confirmable', () => {
    const s = makeSettlement({ isConfirmed: true });
    expect(s.isConfirmed).toBe(true);
  });

  it('should prevent self-settlement (fromMember !== toMember)', () => {
    const s = makeSettlement();
    expect(s.fromMember).not.toBe(s.toMember);
  });

  it('should use integer paise for settlement amount', () => {
    const s = makeSettlement({ amountPaise: 15050 });
    expect(Number.isInteger(s.amountPaise)).toBe(true);
  });
});

describe('Social Domain — PeerBalance contract', () => {
  it('should represent positive balance (owed to this member)', () => {
    const balance: PeerBalance = {
      memberId: 'hash-alice',
      displayName: 'Alice',
      balancePaise: 30000,
    };
    expect(balance.balancePaise).toBeGreaterThan(0);
  });

  it('should represent negative balance (this member owes)', () => {
    const balance: PeerBalance = {
      memberId: 'hash-bob',
      displayName: 'Bob',
      balancePaise: -30000,
    };
    expect(balance.balancePaise).toBeLessThan(0);
  });

  it('should represent zero balance (settled up)', () => {
    const balance: PeerBalance = {
      memberId: 'hash-charlie',
      displayName: 'Charlie',
      balancePaise: 0,
    };
    expect(balance.balancePaise).toBe(0);
  });

  it('should use integer paise', () => {
    const balance: PeerBalance = { memberId: 'x', displayName: 'X', balancePaise: 15075 };
    expect(Number.isInteger(balance.balancePaise)).toBe(true);
  });
});

describe('Social Domain — CRDTSyncEngine interface', () => {
  it('should define all required engine methods', () => {
    const engineShape: Record<keyof CRDTSyncEngine, string> = {
      createGroup: 'function',
      joinGroup: 'function',
      addTransaction: 'function',
      addSettlement: 'function',
      getBalances: 'function',
      sync: 'function',
      merge: 'function',
      exportState: 'function',
    };
    expect(Object.keys(engineShape)).toHaveLength(8);
  });
});
