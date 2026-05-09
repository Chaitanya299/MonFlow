import { NativeModules } from 'react-native';
import { UniversalParser } from './UniversalParser';

const { MonfloBridge } = NativeModules;

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
      if (!UniversalParser.isPromotional(alert.rawText)) {
        const tx = UniversalParser.parse(alert.rawText);
        if (tx) {
          // TODO: Integrate with AccountingRepository in Task 6
          console.log(`Parsed transaction: ${tx.amountPaise} ${tx.currency}`);
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
