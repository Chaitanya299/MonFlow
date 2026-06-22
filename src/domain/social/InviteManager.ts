import { Linking } from 'react-native';
import { IdentityManager } from './IdentityManager';

export interface InvitePayload {
  groupId: string;
  creatorPubKey: string;
  creatorName: string;
}

export class InviteManager {
  /**
   * Generates a sharing-friendly invite link for a group.
   */
  static async generateInviteLink(groupId: string, groupName: string): Promise<string> {
    const pubKey = await IdentityManager.getPublicKey();

    const payload: InvitePayload = {
      groupId,
      creatorPubKey: pubKey,
      creatorName: 'A Friend' // Simplified for prototype
    };

    // Base64 encode the JSON payload
    const encoded = btoa(JSON.stringify(payload));
    return `monflo://invite?data=${encoded}`;
  }

  /**
   * Parses an invite link and returns the group information.
   */
  static parseInviteLink(url: string): InvitePayload | null {
    try {
      const queryString = url.split('?')[1];
      const params = new URLSearchParams(queryString);
      const data = params.get('data');

      if (!data) return null;

      const decoded = JSON.parse(atob(data));
      return decoded as InvitePayload;
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
