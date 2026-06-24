import { NativeModules } from 'react-native';
import { UniversalParser } from './UniversalParser';
import { MerchantDetector } from './MerchantDetector';
import { NativeAccountingRepository } from '../accounting/NativeAccountingRepository';
import { ProcessedTransaction } from '../accounting/types';

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
      if (!UniversalParser.isPromotional(alert.rawText, alert.packageName)) {
        const tx = UniversalParser.parse(alert.rawText, alert.packageName);
        if (tx) {
          const detector = MerchantDetector.getInstance();
          const merchantName = tx.events[0]?.merchantName || null;
          const category = detector.categorize(merchantName);

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
