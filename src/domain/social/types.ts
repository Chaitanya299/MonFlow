export interface SplitGroup {
  id: string;
  metadata: GroupMetadata;
  members: Record<string, MemberProfile>;
  transactions: Record<string, SplitTransaction>;
  settlements: Record<string, SettlementRecord>;
}

export interface GroupMetadata {
  name: string;
  createdAt: number;
  createdBy: string;
}

export interface MemberProfile {
  phoneNumberHash: string;
  displayName: string;
  publicKey: string;
  joinedAt: number;
}

export interface SplitTransaction {
  id: string;
  amountPaise: number;
  paidBy: string;
  splitAmong: string[];
  description: string;
  timestamp: number;
}

export interface SettlementRecord {
  id: string;
  fromMember: string;
  toMember: string;
  amountPaise: number;
  isConfirmed: boolean;
  timestamp: number;
}

export interface PeerBalance {
  memberId: string;
  displayName: string;
  balancePaise: number;
}
