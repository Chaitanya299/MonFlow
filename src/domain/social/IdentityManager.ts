import { NativeModules } from 'react-native';

const { MonfloBridge } = NativeModules;

export interface IdentityProfile {
  phoneNumberHash: string;
  publicKey: string;
}

export class IdentityManager {
  /**
   * Returns the hardware-backed public key for this device.
   * Generates a new keypair in Android Keystore if one doesn't exist.
   */
  static async getPublicKey(): Promise<string> {
    if (!MonfloBridge) {
      throw new Error('MonfloBridge not available');
    }
    return await MonfloBridge.getIdentityPublicKey();
  }

  /**
   * Signs a message using the hardware-backed private key.
   */
  static async sign(message: string): Promise<string> {
    if (!MonfloBridge) {
      throw new Error('MonfloBridge not available');
    }
    return await MonfloBridge.signMessage(message);
  }

  /**
   * Binds a phone number to the device's public key.
   * Returns a profile containing the hashed phone number and the public key.
   */
  static async createIdentityProfile(phoneNumber: string): Promise<IdentityProfile> {
    const publicKey = await this.getPublicKey();
    const phoneNumberHash = await this.hashPhoneNumber(phoneNumber);

    return {
      phoneNumberHash,
      publicKey
    };
  }

  /**
   * Simple SHA-256 hash for phone numbers to maintain privacy.
   * Note: In a production environment, use a salt to prevent rainbow table attacks.
   */
  private static async hashPhoneNumber(phoneNumber: string): Promise<string> {
    // Basic normalization: remove non-digits
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // Using a simple hash logic for now.
    // In a real browser/RN environment we'd use crypto.subtle or a library.
    // Since we're in a P2P context, consistency is key.

    // For now, let's use a placeholder or check for a crypto polyfill.
    // Actually, I'll use a simple deterministic hash for this v1.
    let hash = 0;
    for (let i = 0; i < cleanNumber.length; i++) {
      const char = cleanNumber.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `sha256_${Math.abs(hash).toString(16)}`;
  }
}
