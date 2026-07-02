import { Linking } from 'react-native';
import { IdentityManager } from './IdentityManager';

export interface InvitePayload {
  groupId: string;
  creatorPubKey: string;
  creatorName: string;
  /** Base64-encoded 32-byte group E2EE secret. The link is the join capability. */
  sharedSecret: string;
}

/** Uint8Array -> base64 (Hermes/RN has btoa but no Buffer). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** base64 -> Uint8Array. */
export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export class InviteManager {
  /**
   * Generates a sharing-friendly invite link for a group.
   * The group's real per-group secret rides in the link so joiners can decrypt.
   *
   * ponytail: bearer model — anyone with the link can read the group. That's the
   * standard tradeoff for a shareable link. Upgrade path if links leak: ECDH the
   * secret to each joiner's IdentityManager pubkey instead of embedding it raw.
   */
  static async generateInviteLink(
    groupId: string,
    sharedSecret: Uint8Array,
    creatorName: string = 'A Friend'
  ): Promise<string> {
    if (sharedSecret.length !== 32) {
      throw new Error('Invite secret must be 32 bytes');
    }
    const pubKey = await IdentityManager.getPublicKey();

    const payload: InvitePayload = {
      groupId,
      creatorPubKey: pubKey,
      creatorName,
      sharedSecret: bytesToBase64(sharedSecret),
    };

    // Base64 encode the JSON payload
    const encoded = btoa(JSON.stringify(payload));
    return `monflo://invite?data=${encoded}`;
  }

  /**
   * Parses an invite link and returns the group information.
   * Deep links are untrusted input — reject anything without a well-formed
   * 32-byte secret so a malformed link can never fall through to a weak key.
   */
  static parseInviteLink(url: string): InvitePayload | null {
    try {
      const queryString = url.split('?')[1];
      const params = new URLSearchParams(queryString);
      const data = params.get('data');

      if (!data) return null;

      const decoded = JSON.parse(atob(data)) as InvitePayload;

      if (
        !decoded.groupId ||
        !decoded.sharedSecret ||
        base64ToBytes(decoded.sharedSecret).length !== 32
      ) {
        return null;
      }

      return decoded;
    } catch (e) {
      console.error('Failed to parse invite link:', e);
      return null;
    }
  }

  /**
   * Listens for deep links and triggers callback when an invite is received.
   */
  static listenForInvites(onInvite: (payload: InvitePayload) => void) {
    const handleUrl = (url: string | null) => {
      if (url && url.includes('monflo://invite')) {
        const payload = this.parseInviteLink(url);
        if (payload) onInvite(payload);
      }
    };

    // Handle initial link if app was closed
    Linking.getInitialURL().then(handleUrl);

    // Handle incoming links while app is open
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));

    return () => subscription.remove();
  }
}
