# Design Spec: Android SQLCipher & Keystore Integration

**Status:** DRAFT  
**Date:** 2026-05-10  
**Author:** Antigravity (Claude)  

## 1. Overview
Fulfill the "Extreme Privacy" promise of Monflo by implementing hardware-backed AES-256 encryption for the local transaction database. This design uses the Android Keystore for key protection and a BIP-39 12-word recovery phrase as the master source of entropy.

## 2. Technical Architecture

### 2.1 Key Derivation Flow
1. **Source of Entropy:** BIP-39 Mnemonic (12 words).
2. **Master Seed:** 128-bit entropy derived from the mnemonic.
3. **Database Passphrase:** Derived using **PBKDF2WithHmacSHA256**.
   - Salt: Hardware-bound identifier (Android ID).
   - Iterations: 10,000.
   - Result: 256-bit AES key used for SQLCipher.

### 2.2 Native Components (Kotlin)

#### 2.2.1 `VaultManager.kt` (Singleton)
- Orchestrates database initialization.
- Fetches the Master Seed from the Keystore.
- Performs PBKDF2 derivation.
- Injects the `SupportOpenHelperFactory` into the Room database instance.

#### 2.2.2 `KeystoreHelper.kt`
- Manages an AES-GCM key inside the `AndroidKeyStore`.
- This hardware key is used to encrypt/decrypt the **Master Seed** stored in Private Preferences.
- Ensures the seed is never stored in plaintext on disk.

#### 2.2.3 `MnemonicHelper.kt`
- Implements BIP-39 word generation and entropy conversion.
- Used only during First Launch and Recovery flows.

## 3. Data Flow & Interaction

### 3.1 First Launch (Auto-Generate)
1. App generates 12 words via `MnemonicHelper`.
2. App encrypts the resulting seed via `KeystoreHelper` and saves to disk.
3. App derives the SQLCipher key and creates the Room DB.
4. UI displays the 12 words to the user for safe keeping.

### 3.2 Background Tracking (Transparent)
1. `NotificationListenerService` wakes up.
2. Calls `VaultManager.getDatabase()`.
3. `VaultManager` fetches the seed from Keystore (hardware-backed, no user interaction required).
4. `VaultManager` re-derives the key and opens the Room DB.

### 3.3 Recovery (Phone Lost)
1. User enters 12 words on a new phone.
2. `VaultManager` re-derives the seed and encrypts it for the NEW phone's hardware.
3. App re-derives the same SQLCipher key.
4. App unlocks the Google Drive backup blob.

## 4. Security Considerations
- **SQLCipher AES-256:** Encrypts every byte of the SQLite file at rest.
- **Hardware Bound:** The salt includes the Android ID, ensuring the database file cannot be easily moved and decrypted on another device without the 12-word key.
- **Biometric UI Gate:** While the DB is transparent to the service, the React Native UI will implement a `BiometricPrompt` gate before showing any data from the vault.

## 5. Success Criteria
- The `NativeDatabase.getInstance()` call successfully opens the encrypted file using a derived hardware key.
- The 12-word mnemonic successfully re-derives the same database key on a simulated "New Device."
- No database passphrase or seed is stored in plaintext on the filesystem or inside the APK.
