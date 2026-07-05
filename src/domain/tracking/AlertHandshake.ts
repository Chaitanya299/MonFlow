import { NativeModules } from 'react-native';
import { UniversalParser } from './UniversalParser';
import { NativeAccountingRepository } from '../accounting/NativeAccountingRepository';
import { ProcessedTransaction } from '../accounting/types';
import { categorize } from '../accounting/TransactionCategorizer';

const { MonfloBridge } = NativeModules;
const repository = new NativeAccountingRepository();

export interface RawAlert {
  id: number;
  rawText: string;
  packageName: string;
  timestamp: number;
}

/**
 * Orchestrates the handshake between Native and JS layers.
 * Fetches pending alerts, parses them, and clears the native inbox.
 */
export const runHandshake = async () => {
  if (!MonfloBridge) {
    console.warn('MonfloBridge not available. Skipping handshake.');
    return;
  }

  try {
    const alerts: RawAlert[] = await MonfloBridge.getPendingAlerts();
    if (!alerts || alerts.length === 0) return;

    const processedIds: number[] = [];

    for (const alert of alerts) {
      let tx: ReturnType<typeof UniversalParser.parse> = null;
      let promotional = false;
      try {
        promotional = UniversalParser.isPromotional(alert.rawText, alert.packageName);
        if (!promotional) {
          tx = UniversalParser.parse(alert.rawText, alert.packageName);
        }
      } catch (e) {
        // One malformed alert must not stall the whole inbox;
        // fall through so the raw text is preserved below
      }

      if (!promotional) {
        if (tx) {
          const merchantName = tx.events[0]?.merchantName ?? null;
          const category = categorize(merchantName, alert.rawText);
          const processedTx: ProcessedTransaction = {
            id: `tx_${Date.now()}_${alert.id}`,
            amountPaise: tx.amountPaise,
            currency: tx.currency,
            trustLevel: tx.trustLevel,
            merchantName,
            category,
            tags: [],
            sourcePackage: alert.packageName,
            rawText: alert.rawText,
            timestamp: alert.timestamp,
            isSplit: false,
            splitGroupId: null
          };

          await repository.save(processedTx);
          console.log(`Parsed transaction: ${tx.amountPaise} ${tx.currency} → ${category} (${merchantName})`);
        } else {
          // Parser miss: keep the raw alert visible in the Untagged Bucket
          // instead of silently deleting it. amountPaise 0 marks "needs manual entry".
          const fallbackTx: ProcessedTransaction = {
            id: `raw_${Date.now()}_${alert.id}`,
            amountPaise: 0,
            currency: 'INR',
            trustLevel: 'UNKNOWN',
            merchantName: null,
            category: 'untagged',
            tags: ['unparsed'],
            sourcePackage: alert.packageName,
            rawText: alert.rawText,
            timestamp: alert.timestamp,
            isSplit: false,
            splitGroupId: null
          };
          await repository.save(fallbackTx);
        }
      }
      processedIds.push(alert.id);
    }

    if (processedIds.length > 0) {
      await MonfloBridge.clearProcessedAlerts(processedIds);
    }
  } catch (error) {
    console.error('Handshake failed:', error);
  }
};
