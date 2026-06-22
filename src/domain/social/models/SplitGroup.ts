export interface Member {
  id: string; // Hashed phone number
  pubKey: string; // Ed25519 Public Key
  name: string;
  joinedAt: number;
}

export interface Transaction {
  id: string;
  amountPaise: number;
  description: string;
  payerId: string;
  participants: string[]; // member IDs
  timestamp: number;
}

export interface Settlement {
  id: string;
  fromMember: string;
  toMember: string;
  amountPaise: number;
  isConfirmed: boolean;
  timestamp: number;
}

export interface SplitGroupDoc {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  members: Record<string, Member>;
  transactions: Record<string, Transaction>;
  settlements: Record<string, Settlement>;
}
