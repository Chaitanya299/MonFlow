export interface ProcessedTransaction {
  id: string;
  amountPaise: number;
  currency: string;
  merchantName: string | null;
  category: TransactionCategory;
  tags: string[];
  sourcePackage: string;
  rawText: string;
  timestamp: number;
  isSplit: boolean;
  splitGroupId: string | null;
  trustLevel: 'VERIFIED' | 'SCAM_RISK' | 'UNKNOWN';
}

export type TransactionCategory =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'entertainment'
  | 'health'
  | 'transfer'
  | 'untagged';

export interface DailySummary {
  date: string;
  totalSpentPaise: number;
  totalReceivedPaise: number;
  transactionCount: number;
  byCategory: Record<TransactionCategory, number>;
}
