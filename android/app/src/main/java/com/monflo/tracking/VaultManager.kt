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

    fun isInitialized(): Boolean = prefs.contains("enc_entropy")

    fun getDatabasePassphrase(): ByteArray {
        // Self-heal: if the vault was never initialized (e.g. a background
        // NotificationService/SmsReceiver opens the DB before the app's first
        // launch), generate entropy now. Without this the stored IV is empty and
        // KeystoreHelper.decrypt throws "unsupported IV length: 0 bytes".
        if (!isInitialized()) {
            initializeNewVault()
        }
        val encEntropy = Base64.decode(prefs.getString("enc_entropy", ""), Base64.DEFAULT)
        val iv = Base64.decode(prefs.getString("enc_iv", ""), Base64.DEFAULT)
        val entropy = KeystoreHelper.decrypt(encEntropy, iv)

        // PBKDF2 Derivation
        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val androidId = android.provider.Settings.Secure.getString(context.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
        val spec: KeySpec = PBEKeySpec(Base64.encodeToString(entropy, Base64.DEFAULT).toCharArray(), androidId.toByteArray(), 10000, 256)
        return factory.generateSecret(spec).encoded
    }
}
