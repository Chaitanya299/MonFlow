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
