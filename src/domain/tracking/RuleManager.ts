import { NativeModules } from 'react-native';
import * as nacl from 'tweetnacl';

const { MonfloBridge } = NativeModules;

export interface Rule {
  id: string;
  pattern: string;
  flags: string;
  version: number;
}

export interface RuleBundle {
  version: number;
  rules: Rule[];
  signature: string; // Base64 encoded Ed25519 signature
}

// Hardcoded developer public key for verification (placeholder)
// In a real app, this would be the public key of the server/dev team.
const DEVELOPER_PUBLIC_KEY_BASE64 = 'rO08WdI5kG7Xy+XnS7bZ6QO8q2L+W/H+zS5n9I8n4uI=';

export class RuleManager {
  private static activeRules: Rule[] = [];

  /**
   * Loads rules from the local encrypted database.
   */
  static async loadLocalRules(): Promise<Rule[]> {
    if (!MonfloBridge) return [];
    try {
      this.activeRules = await MonfloBridge.getRules();
      return this.activeRules;
    } catch (e) {
      console.error('Failed to load rules:', e);
      return [];
    }
  }

  /**
   * Verifies and applies a new rule bundle.
   */
  static async fetchAndApplyBundle(bundle: RuleBundle): Promise<boolean> {
    const isValid = this.verifyBundle(bundle);
    if (!isValid) {
      console.error('Rule bundle signature verification failed!');
      return false;
    }

    try {
      if (MonfloBridge) {
        await MonfloBridge.saveRules(bundle.rules);
        this.activeRules = bundle.rules;
        return true;
      }
    } catch (e) {
      console.error('Failed to save verified rules:', e);
    }
    return false;
  }

  /**
   * Returns currently active rules.
   */
  static getRules(): Rule[] {
    return this.activeRules;
  }

  /**
   * Cryptographically verifies the bundle signature using Ed25519.
   */
  private static verifyBundle(bundle: RuleBundle): Boolean {
    try {
      const pubKey = this.decodeBase64(DEVELOPER_PUBLIC_KEY_BASE64);
      const signature = this.decodeBase64(bundle.signature);

      // We sign the JSON representation of the rules and version
      const message = JSON.stringify({
        version: bundle.version,
        rules: bundle.rules
      });
      const messageBytes = new TextEncoder().encode(message);

      return nacl.sign.detached.verify(messageBytes, signature, pubKey);
    } catch (e) {
      console.error('Verification error:', e);
      return false;
    }
  }

  private static decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
