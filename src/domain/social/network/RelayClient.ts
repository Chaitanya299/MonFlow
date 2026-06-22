import * as nacl from 'tweetnacl';

export class RelayClient {
  private ws: WebSocket | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = 'wss://relay.monflo.app') {
    this.baseUrl = baseUrl;
  }

  /**
   * Pushes an encrypted blob to the private relay mailbox.
   */
  async push(groupId: string, change: Uint8Array, sharedSecret: Uint8Array): Promise<void> {
    // Encrypt for the mailbox (using SecretBox like Waku)
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encrypted = nacl.secretbox(change, nonce, sharedSecret);

    const payload = new Uint8Array(nonce.length + encrypted.length);
    payload.set(nonce);
    payload.set(encrypted, nonce.length);

    // Simple fetch or WS call. Design says "WebSocket relay".
    // For "push", a simple POST might be more reliable, but we'll use WS as per spec.
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`${this.baseUrl}/push/${groupId}`);
      socket.onopen = () => {
        socket.send(payload);
        socket.close();
        resolve();
      };
      socket.onerror = (e) => reject(e);
    });
  }

  /**
   * Pulls encrypted blobs from the private relay mailbox.
   */
  async pull(
    groupId: string,
    sharedSecret: Uint8Array,
    onMessage: (change: Uint8Array) => void
  ): Promise<void> {
    this.ws = new WebSocket(`${this.baseUrl}/subscribe/${groupId}`);

    this.ws.onmessage = (event) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          const payload = new Uint8Array(reader.result);
          this.processPayload(payload, sharedSecret, onMessage);
        }
      };
      if (event.data instanceof Blob) {
        reader.readAsArrayBuffer(event.data);
      }
    };

    this.ws.onerror = (e) => console.error('Relay WS Error:', e);
  }

  private processPayload(
    payload: Uint8Array,
    sharedSecret: Uint8Array,
    onMessage: (change: Uint8Array) => void
  ) {
    try {
      const nonce = payload.slice(0, nacl.secretbox.nonceLength);
      const encrypted = payload.slice(nacl.secretbox.nonceLength);

      const decrypted = nacl.secretbox.open(encrypted, nonce, sharedSecret);
      if (decrypted) {
        onMessage(decrypted);
      }
    } catch (e) {
      console.error('Failed to process relay payload:', e);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
