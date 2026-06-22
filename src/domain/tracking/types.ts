export type TrustLevel = 'VERIFIED' | 'SCAM_RISK' | 'UNKNOWN';
export type FinancialEventType = 'debit' | 'credit' | 'cashback' | 'refund' | 'reversal' | 'unknown';
export type TransactionStatus = 'initiated' | 'processing' | 'pending' | 'success' | 'failed' | 'reversal';
export type TrustScore = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface FinancialEvent {
  type: FinancialEventType;
  amountPaise: number;
  currency: string;
  merchantName: string | null;
  status: TransactionStatus;
  trustScore: TrustScore;
  rawSegment: string;
  parserVersion: string;
  templateId: string | null;
  tier: number;
  referenceId: string | null;
  accountFingerprint: string | null;
}

export interface ParsingResult {
  amountPaise: number;
  currency: string;
  trustLevel: TrustLevel;
  events: FinancialEvent[];
  parserVersion: string;
  templateId: string | null;
  confidence: number;
  timestamp: number;
  rawText: string;
  sourcePackage: string;
  referenceId: string | null;
  accountFingerprint: string | null;
}

export interface TemplatePlaceholder {
  name: string;
  type: 'currency' | 'string' | 'account';
}

export interface CompiledTemplate {
  staticSegments: string[];
  placeholders: TemplatePlaceholder[];
}
