import { NativeModules } from 'react-native';

const { MonfloBridge } = NativeModules;

export class SecurityManager {
  /**
   * Triggers the system biometric prompt.
   * Returns 'SUCCESS', 'CANCELED', or 'NOT_SUPPORTED'.
   */
  static async authenticate(): Promise<'SUCCESS' | 'CANCELED' | 'NOT_SUPPORTED'> {
    if (!MonfloBridge) {
      throw new Error('MonfloBridge not available');
    }
    return await MonfloBridge.authenticate(
      'Monflo Vault',
      'Authenticate to access your financial data'
    );
  }

  /**
   * Enables or disables the biometric gate requirement.
   */
  static async setEnabled(enabled: boolean): Promise<void> {
    if (!MonfloBridge) return;
    await MonfloBridge.setBiometricEnabled(enabled);
  }

  /**
   * Checks if the biometric gate is currently enabled.
   */
  static async isEnabled(): Promise<boolean> {
    if (!MonfloBridge) return false;
    return await MonfloBridge.isBiometricEnabled();
  }

  /**
   * Full gate check: if enabled, require auth.
   * Returns true if authorized or if gate is disabled.
   */
  static async checkGate(): Promise<boolean> {
    const enabled = await this.isEnabled();
    if (!enabled) return true;

    const result = await this.authenticate();
    return result === 'SUCCESS';
  }
}
