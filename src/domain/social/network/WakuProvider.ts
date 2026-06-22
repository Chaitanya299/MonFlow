import { createLightNode, type LightNode } from '@waku/sdk';
import { createEncoder, createDecoder } from '@waku/sdk';
import * as nacl from 'tweetnacl';

export class WakuProvider {
  private node: LightNode | null = null;
  private subscriptions: Map<string, any> = new Map();

  /**
   * Initializes the Waku node.
   */
  async start(): Promise<void> {
    if (this.node) return;

    this.node = await createLightNode({ defaultBootstrap: true });
    await this.node.start();
    console.log('Waku node started');
  }

  /**
   * Stops the Waku node.
   */
  async stop(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
    }
  }

  /**
   * Broadcasts an encrypted Automerge change to a group topic.
   * @param groupId The group ID (used for topic name)
   * @param change The Automerge change (binary)
   * @param sharedSecret The group's shared secret (32 bytes)
   */
  async broadcast(groupId: string, change: Uint8Array, sharedSecret: Uint8Array): Promise<void> {
    if (!this.node) throw new Error('Waku node not started');

    const contentTopic = `/monflo/1/group-${groupId}/proto`;
    const encoder = createEncoder({ contentTopic });

    // Encrypt the change using TweetNaCl (AES-256-GCM alternative: SecretBox)
    // Note: secretbox uses XSalsa20-Poly1305 which is comparable to GCM for this use case.
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encrypted = nacl.secretbox(change, nonce, sharedSecret);

    // Combine nonce + encrypted data
    const payload = new Uint8Array(nonce.length + encrypted.length);
    payload.set(nonce);
    payload.set(encrypted, nonce.length);

    await this.node.lightPush.send(encoder, { payload });
    console.log(`Broadcasted change to ${contentTopic}`);
  }

  /**
   * Subscribes to a group topic and calls callback on new changes.
   * @param groupId The group ID
   * @param sharedSecret The group's shared secret
   * @param onMessage Callback with decrypted change
   */
  async subscribe(
    groupId: string,
    sharedSecret: Uint8Array,
    onMessage: (change: Uint8Array) => void
  ): Promise<void> {
    if (!this.node) throw new Error('Waku node not started');

    const contentTopic = `/monflo/1/group-${groupId}/proto`;
    const decoder = createDecoder(contentTopic);

    const unsubscribe = await this.node.filter.subscribe([decoder], (wakuMessage) => {
      if (!wakuMessage.payload) return;

      try {
        const payload = wakuMessage.payload;
        const nonce = payload.slice(0, nacl.secretbox.nonceLength);
        const encrypted = payload.slice(nacl.secretbox.nonceLength);

        const decrypted = nacl.secretbox.open(encrypted, nonce, sharedSecret);
        if (decrypted) {
          onMessage(decrypted);
        } else {
          console.error('Failed to decrypt Waku message');
        }
      } catch (e) {
        console.error('Error processing Waku message:', e);
      }
    });

    this.subscriptions.set(groupId, unsubscribe);
    console.log(`Subscribed to ${contentTopic}`);
  }

  /**
   * Unsubscribes from a group topic.
   */
  async unsubscribe(groupId: string): Promise<void> {
    const unsubscribe = this.subscriptions.get(groupId);
    if (unsubscribe) {
      await unsubscribe();
      this.subscriptions.delete(groupId);
    }
  }
}
