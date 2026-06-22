import { WakuProvider } from './WakuProvider';
import { RelayClient } from './RelayClient';

export class FailoverManager {
  private waku: WakuProvider;
  private relay: RelayClient;
  private FAILOVER_TIMEOUT_MS = 5000;

  constructor(waku: WakuProvider, relay: RelayClient) {
    this.waku = waku;
    this.relay = relay;
  }

  /**
   * Broadcasts a change with failover logic.
   * Tries Waku first, then falls back to Relay if Waku is slow or fails.
   */
  async broadcast(groupId: string, change: Uint8Array, sharedSecret: Uint8Array): Promise<void> {
    let wakuSuccess = false;

    // Start Waku broadcast
    const wakuPromise = this.waku.broadcast(groupId, change, sharedSecret)
      .then(() => { wakuSuccess = true; })
      .catch(err => console.warn('Waku broadcast failed:', err));

    // Wait for Waku with a timeout
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, this.FAILOVER_TIMEOUT_MS));

    await Promise.race([wakuPromise, timeoutPromise]);

    if (!wakuSuccess) {
      console.log('Waku broadcast slow or failed, falling back to Private Relay...');
      await this.relay.push(groupId, change, sharedSecret);
    }
  }

  /**
   * Subscribes to both Waku and Relay to ensure message delivery.
   */
  async subscribe(
    groupId: string,
    sharedSecret: Uint8Array,
    onMessage: (change: Uint8Array) => void
  ): Promise<void> {
    // Deduplication set to prevent processing the same change from both Waku and Relay
    const seenChanges = new Set<string>();

    const wrappedOnMessage = (change: Uint8Array) => {
      const hash = this.hashChange(change);
      if (!seenChanges.has(hash)) {
        seenChanges.add(hash);
        onMessage(change);

        // Keep set size manageable
        if (seenChanges.size > 1000) {
          const firstItem = seenChanges.values().next().value;
          if (firstItem) seenChanges.delete(firstItem);
        }
      }
    };

    // Subscribe to both
    await this.waku.subscribe(groupId, sharedSecret, wrappedOnMessage);
    await this.relay.pull(groupId, sharedSecret, wrappedOnMessage);
  }

  /**
   * Simple hash function for deduplication.
   */
  private hashChange(change: Uint8Array): string {
    // In a real implementation, Automerge change hashes or a proper SHA-256 would be used.
    // For this prototype, we'll use a simple string representation of the first 64 bytes.
    return change.slice(0, 64).toString();
  }
}
