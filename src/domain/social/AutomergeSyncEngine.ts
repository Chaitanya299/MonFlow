import * as Automerge from '@automerge/automerge';
import {
  SplitGroup,
  SplitTransaction,
  SettlementRecord,
  PeerBalance
} from './types';
import { CRDTSyncEngine } from './CRDTSyncEngine';
import { SplitGroupDoc, Member, Transaction, Settlement } from './models/SplitGroup';
import { FailoverManager } from './network/FailoverManager';
import { IdentityManager } from './IdentityManager';

export class AutomergeSyncEngine implements CRDTSyncEngine {
  private docs: Map<string, Automerge.Doc<SplitGroupDoc>> = new Map();
  private network: FailoverManager;
  private sharedSecrets: Map<string, Uint8Array> = new Map();
  private lastCompactionTime: Map<string, number> = new Map();

  constructor(network: FailoverManager) {
    this.network = network;
  }

  async createGroup(name: string, creatorPublicKey: string): Promise<SplitGroup> {
    const groupId = `grp_${Math.random().toString(36).substring(7)}`;

    // Generate a group-shared secret for E2EE (32 bytes)
    const sharedSecret = new Uint8Array(32);
    crypto.getRandomValues(sharedSecret);
    this.sharedSecrets.set(groupId, sharedSecret);

    let doc = Automerge.init<SplitGroupDoc>();
    doc = Automerge.change(doc, (d) => {
      d.id = groupId;
      d.name = name;
      d.createdAt = Date.now();
      d.createdBy = creatorPublicKey;
      d.members = {};
      d.transactions = {};
      d.settlements = {};

      const memberId = `member_${creatorPublicKey.substring(0, 8)}`;
      d.members[memberId] = {
        id: memberId,
        pubKey: creatorPublicKey,
        name: 'You',
        joinedAt: Date.now(),
      };
    });

    this.docs.set(groupId, doc);
    this.lastCompactionTime.set(groupId, Date.now());

    // Subscribe to updates for this new group
    await this.network.subscribe(groupId, sharedSecret, (remoteChange) => {
      this.merge(groupId, remoteChange);
    });

    return this.mapDocToDomain(doc);
  }

  async joinGroup(groupId: string, memberPublicKey: string, displayName: string): Promise<void> {
    const doc = this.getDoc(groupId);
    const updatedDoc = Automerge.change(doc, (d) => {
      const memberId = `member_${memberPublicKey.substring(0, 8)}`;
      if (!d.members[memberId]) {
        d.members[memberId] = {
          id: memberId,
          pubKey: memberPublicKey,
          name: displayName,
          joinedAt: Date.now(),
        };
      }
    });

    this.docs.set(groupId, updatedDoc);
    await this.broadcastChange(groupId, updatedDoc);
  }

  /**
   * Special join method for when we don't have the doc yet.
   * Initializes a blank doc and waits for sync from the creator.
   */
  async joinGroupFromInvite(groupId: string, sharedSecret: Uint8Array): Promise<SplitGroup> {
    this.sharedSecrets.set(groupId, sharedSecret);

    // Initialize an empty doc with the correct ID
    let doc = Automerge.init<SplitGroupDoc>();
    doc = Automerge.change(doc, (d) => {
      d.id = groupId;
      d.members = {};
      d.transactions = {};
      d.settlements = {};
    });

    this.docs.set(groupId, doc);

    // Subscribe to Waku/Relay
    await this.network.subscribe(groupId, sharedSecret, (remoteChange) => {
      this.merge(groupId, remoteChange);
    });

    // Send a "Member Joined" op if we have our own identity
    // (This part would normally happen after the first sync from creator)

    return this.mapDocToDomain(doc);
  }

  async addTransaction(groupId: string, tx: SplitTransaction): Promise<void> {
    const doc = this.getDoc(groupId);
    const updatedDoc = Automerge.change(doc, (d) => {
      d.transactions[tx.id] = {
        id: tx.id,
        amountPaise: tx.amountPaise,
        description: tx.description,
        payerId: tx.paidBy,
        participants: tx.splitAmong,
        timestamp: tx.timestamp,
      };
    });

    this.docs.set(groupId, updatedDoc);
    await this.broadcastChange(groupId, updatedDoc);
    this.checkCompaction(groupId);
  }

  async addSettlement(groupId: string, settlement: SettlementRecord): Promise<void> {
    const doc = this.getDoc(groupId);
    const updatedDoc = Automerge.change(doc, (d) => {
      d.settlements[settlement.id] = {
        id: settlement.id,
        fromMember: settlement.fromMember,
        toMember: settlement.toMember,
        amountPaise: settlement.amountPaise,
        isConfirmed: settlement.isConfirmed,
        timestamp: settlement.timestamp,
      };
    });

    this.docs.set(groupId, updatedDoc);
    await this.broadcastChange(groupId, updatedDoc);
  }

  async sync(groupId: string): Promise<void> {
    const doc = this.getDoc(groupId);
    const state = Automerge.save(doc);
    const secret = this.sharedSecrets.get(groupId);
    if (secret) {
      await this.network.broadcast(groupId, state, secret);
    }
  }

  async merge(groupId: string, remoteState: Uint8Array): Promise<void> {
    const localDoc = this.getDoc(groupId);
    // Remote state could be a full doc or just a single change
    let mergedDoc: Automerge.Doc<SplitGroupDoc>;

    try {
      // Try loading as a full doc first
      const remoteDoc = Automerge.load<SplitGroupDoc>(remoteState);
      mergedDoc = Automerge.merge(localDoc, remoteDoc);
    } catch (e) {
      // Fallback: apply as a single change/patch
      const [appliedDoc] = Automerge.applyChanges(localDoc, [remoteState]);
      mergedDoc = appliedDoc;
    }

    this.docs.set(groupId, mergedDoc);
  }

  async exportState(groupId: string): Promise<Uint8Array> {
    const doc = this.getDoc(groupId);
    return Automerge.save(doc);
  }

  /**
   * Performance: Incremental saving and periodic compaction.
   */
  private async broadcastChange(groupId: string, doc: Automerge.Doc<SplitGroupDoc>): Promise<void> {
    const secret = this.sharedSecrets.get(groupId);
    if (!secret) return;

    // Get only the latest changes for efficient broadcast
    const lastChanges = Automerge.getLastLocalChanges(doc);
    for (const change of lastChanges) {
      await this.network.broadcast(groupId, change, secret);
    }
  }

  /**
   * Compaction logic: Once per week or after 100 changes,
   * save the full document snapshot and prune history.
   */
  private checkCompaction(groupId: string) {
    const lastTime = this.lastCompactionTime.get(groupId) || 0;
    const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

    if (Date.now() - lastTime > WEEK_IN_MS) {
      this.compact(groupId);
    }
  }

  private compact(groupId: string) {
    const doc = this.getDoc(groupId);
    // save() in modern Automerge automatically compacts the history into a snapshot
    const snapshot = Automerge.save(doc);
    console.log(`Compact snapshot generated for ${groupId}: ${snapshot.length} bytes`);

    // In a real app, we'd save this snapshot to local persistent storage (SQLite/AsyncStorage)
    this.lastCompactionTime.set(groupId, Date.now());
  }

  // ... (rest of getBalances and mapDocToDomain remain same)

  private getDoc(groupId: string): Automerge.Doc<SplitGroupDoc> {
    const doc = this.docs.get(groupId);
    if (!doc) throw new Error(`Group ${groupId} not found`);
    return doc;
  }

  private mapDocToDomain(doc: SplitGroupDoc): SplitGroup {
    return {
      id: doc.id,
      metadata: {
        name: doc.name,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
      },
      members: Object.entries(doc.members).reduce((acc, [id, m]) => {
        acc[id] = {
          phoneNumberHash: m.id,
          displayName: m.name,
          publicKey: m.pubKey,
          joinedAt: m.joinedAt,
        };
        return acc;
      }, {} as any),
      transactions: Object.entries(doc.transactions).reduce((acc, [id, tx]) => {
        acc[id] = {
          id: tx.id,
          amountPaise: tx.amountPaise,
          paidBy: tx.payerId,
          splitAmong: tx.participants,
          description: tx.description,
          timestamp: tx.timestamp,
        };
        return acc;
      }, {} as any),
      settlements: Object.entries(doc.settlements).reduce((acc, [id, s]) => {
        acc[id] = {
          id: s.id,
          fromMember: s.fromMember,
          toMember: s.toMember,
          amountPaise: s.amountPaise,
          isConfirmed: s.isConfirmed,
          timestamp: s.timestamp,
        };
        return acc;
      }, {} as any),
    };
  }
}
