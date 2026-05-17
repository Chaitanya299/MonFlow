import { SplitGroup, SplitTransaction, SettlementRecord, PeerBalance } from './types';

export interface CRDTSyncEngine {
  createGroup(name: string, creatorPublicKey: string): Promise<SplitGroup>;
  joinGroup(groupId: string, memberPublicKey: string, displayName: string): Promise<void>;
  addTransaction(groupId: string, tx: SplitTransaction): Promise<void>;
  addSettlement(groupId: string, settlement: SettlementRecord): Promise<void>;
  getBalances(groupId: string): Promise<PeerBalance[]>;
  sync(groupId: string): Promise<void>;
  merge(groupId: string, remoteState: Uint8Array): Promise<void>;
  exportState(groupId: string): Promise<Uint8Array>;
}
