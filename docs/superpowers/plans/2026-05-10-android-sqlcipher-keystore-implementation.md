# Android SQLCipher & Keystore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement hardware-backed AES-256 encryption for the local database using Android Keystore and a BIP-39 recovery phrase.

**Architecture:** A native Kotlin `VaultManager` derives the SQLCipher passphrase from a 128-bit master entropy (seed). This seed is hardware-encrypted by the `AndroidKeyStore` and stored in private preferences. The React Native layer initiates the seed generation and handles the 12-word display.

**Tech Stack:** Kotlin, Android SDK, SQLCipher, Room, Bitcoinj (BIP-39).

---

### Task 1: BIP-39 and Keystore Dependencies

**Files:**
- Modify: `android/app/build.gradle`

- [ ] **Step 1: Add BIP-39 library**

Add to `dependencies` block:
```gradle
implementation 'org.bitcoinj:bitcoinj-core:0.16.2'
```

- [ ] **Step 2: Commit**

```bash
git add android/app/build.gradle
git commit -m "chore: add bitcoinj dependency for BIP-39"
```

### Task 2: Keystore & Entropy Protection

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/KeystoreHelper.kt`

- [ ] **Step 1: Implement hardware-backed AES-GCM encryption**

```kotlin
package com.monflo.tracking

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object KeystoreHelper {
    private const val KEY_ALIAS = "monflo_master_vault_key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        keyStore.getKey(KEY_ALIAS, null)?.let { return it as SecretKey }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        keyGenerator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDINGS_NONE)
                .build()
        )
        return keyGenerator.generateKey()
    }

    fun encrypt(data: ByteArray): Pair<ByteArray, ByteArray> {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        return Pair(cipher.doFinal(data), cipher.iv)
    }

    fun decrypt(encryptedData: ByteArray, iv: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(128, iv)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), spec)
        return cipher.doFinal(encryptedData)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/monflo/tracking/KeystoreHelper.kt
git commit -m "feat: implement KeystoreHelper for hardware-backed encryption"
```

### Task 3: BIP-39 Mnemonic Helper

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/MnemonicHelper.kt`

- [ ] **Step 1: Implement word generation and seed derivation**

```kotlin
package com.monflo.tracking

import org.bitcoinj.crypto.MnemonicCode
import org.bitcoinj.crypto.MnemonicException
import java.security.SecureRandom

object MnemonicHelper {
    fun generateMnemonic(): List<String> {
        val entropy = ByteArray(16) // 128 bits
        SecureRandom().nextBytes(entropy)
        return MnemonicCode.INSTANCE.toMnemonic(entropy)
    }

    fun mnemonicToEntropy(words: List<String>): ByteArray {
        return MnemonicCode.INSTANCE.toEntropy(words)
    }

    fun entropyToMnemonic(entropy: ByteArray): List<String> {
        return MnemonicCode.INSTANCE.toMnemonic(entropy)
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/monflo/tracking/MnemonicHelper.kt
git commit -m "feat: implement MnemonicHelper for BIP-39 support"
```

### Task 4: Vault Orchestration (VaultManager)

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/VaultManager.kt`
- Modify: `android/app/src/main/java/com/monflo/tracking/NativeDatabase.kt`

- [ ] **Step 1: Implement the VaultManager orchestrator**

```kotlin
package com.monflo.tracking

import android.content.Context
import android.util.Base64
import java.security.spec.KeySpec
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class VaultManager(private val context: Context) {
    private val prefs = context.getSharedPreferences("monflo_vault_prefs", Context.MODE_PRIVATE)

    fun initializeNewVault(): List<String> {
        val mnemonic = MnemonicHelper.generateMnemonic()
        val entropy = MnemonicHelper.mnemonicToEntropy(mnemonic)
        saveEntropy(entropy)
        return mnemonic
    }

    private fun saveEntropy(entropy: ByteArray) {
        val (encrypted, iv) = KeystoreHelper.encrypt(entropy)
        prefs.edit()
            .putString("enc_entropy", Base64.encodeToString(encrypted, Base64.DEFAULT))
            .putString("enc_iv", Base64.encodeToString(iv, Base64.DEFAULT))
            .apply()
    }

    fun getDatabasePassphrase(): ByteArray {
        val encEntropy = Base64.decode(prefs.getString("enc_entropy", ""), Base64.DEFAULT)
        val iv = Base64.decode(prefs.getString("enc_iv", ""), Base64.DEFAULT)
        val entropy = KeystoreHelper.decrypt(encEntropy, iv)
        
        // PBKDF2 Derivation
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val spec: KeySpec = PBEKeySpec(Base64.encodeToString(entropy, Base64.DEFAULT).toCharArray(), "monflo_salt".toByteArray(), 10000, 256)
        return factory.generateSecret(spec).encoded
    }
}
```

- [ ] **Step 2: Update NativeDatabase to use VaultManager**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement VaultManager and link to NativeDatabase"
```

### Task 5: Native Bridge Expansion

**Files:**
- Modify: `android/app/src/main/java/com/monflo/tracking/MonfloModule.kt`

- [ ] **Step 1: Add vault methods to the bridge**

Expose `initializeVault` and `getMnemonic` to React Native.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: expose vault initialization to React Native"
```
