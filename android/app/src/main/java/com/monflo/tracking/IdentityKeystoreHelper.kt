package com.monflo.tracking

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature

object IdentityKeystoreHelper {
    private const val KEY_ALIAS = "monflo_identity_key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"

    fun getOrCreateKeyPair(): KeyPair {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val privateKey = keyStore.getKey(KEY_ALIAS, null)
        val publicKey = keyStore.getCertificate(KEY_ALIAS)?.publicKey

        if (privateKey != null && publicKey != null) {
            return KeyPair(publicKey, privateKey as java.security.PrivateKey)
        }

        val kpg = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
        kpg.initialize(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build()
        )
        return kpg.generateKeyPair()
    }

    fun getPublicKeyBase64(): String {
        val keyPair = getOrCreateKeyPair()
        return Base64.encodeToString(keyPair.public.encoded, Base64.NO_WRAP)
    }

    fun sign(data: String): String {
        val keyPair = getOrCreateKeyPair()
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(keyPair.private)
        signature.update(data.toByteArray())
        return Base64.encodeToString(signature.sign(), Base64.NO_WRAP)
    }
}
