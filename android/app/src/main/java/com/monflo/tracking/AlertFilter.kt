package com.monflo.tracking

import android.os.Bundle

object AlertFilter {
    // Tier 1 — pure payment apps: effectively every notification is a transaction
    // alert, so capture raw. Occasional reward/promo notifications are dropped
    // downstream by UniversalParser.isPromotional during the JS handshake.
    val notificationAllowlist = setOf(
        "com.google.android.apps.nbu.paisa.user", // GPay (India)
        "com.phonepe.app",                        // PhonePe
        "net.one97.paytm",                        // Paytm
        "in.org.npci.upiapp",                     // BHIM (NPCI)
        "money.super.payments",                   // super.money (Flipkart)
        "com.naviapp"                              // Navi
    )

    // Tier 2 — SMS apps: bank alerts reach us through their notifications without
    // needing SMS permissions (Play-compliant capture path). Routed as "sms:<sender>"
    // so the JS parser applies TRAI header trust analysis.
    val smsAppAllowlist = setOf(
        "com.google.android.apps.messaging", // Google Messages
        "com.samsung.android.messaging"      // Samsung Messages
    )

    // Tier 3 — mixed-content apps: most of their notifications are NOT financial
    // (chats, order/delivery updates, reward promos). Captured only when the text
    // passes the money-relevance gate, so personal messages and shopping alerts
    // never enter the financial vault.
    val relevanceGatedAllowlist = setOf(
        "com.whatsapp",                    // WhatsApp (Pay)
        "com.dreamplug.androidapp",        // CRED
        "com.csam.icici.bank.imobile",     // ICICI iMobile
        "in.amazon.mShop.android.shopping" // Amazon (Amazon Pay)
    )

    // SMS filters for common Indian bank identifiers (debits and credits)
    private val smsKeywords = setOf(
        "debited", "spent", "sent", "transaction", "paid",
        "credited", "received", "withdrawn"
    )

    /**
     * Analyzes the TRAI-compliant SMS header for classification.
     * Format: [Prefix]-[Header]-[Suffix] (e.g., VM-HDFCBK-T)
     */
    fun analyzeHeader(sender: String?): String {
        if (sender == null) return "UNKNOWN"
        val parts = sender.split("-")
        if (parts.size < 2) return "UNREGISTERED" // Likely 10-digit number or non-DLT

        val suffix = parts.last().uppercase()
        return when (suffix) {
            "T" -> "TRANSACTIONAL"
            "S" -> "SERVICE"
            "P" -> "PROMOTIONAL"
            "G" -> "GOVERNMENT"
            else -> "REGISTERED_OTHER"
        }
    }

    fun extractNotificationText(packageName: String, extras: Bundle?): String? {
        val isPurePayment = notificationAllowlist.contains(packageName)
        val isGated = smsAppAllowlist.contains(packageName) ||
            relevanceGatedAllowlist.contains(packageName)
        if (!isPurePayment && !isGated) return null

        // Long alerts truncate in android.text; android.bigText carries the full body
        val text = extras?.getCharSequence("android.bigText")?.toString()
            ?: extras?.getCharSequence("android.text")?.toString()
            ?: return null
        if (text.length < 5) return null

        // Messaging/shopping/bank apps notify for non-financial events too;
        // keep only money-related notifications out of the vault.
        if (isGated) {
            val sender = extras?.getCharSequence("android.title")?.toString()
            if (!isRelevantSms(sender, text)) return null
        }
        return text
    }

    fun isRelevantSms(sender: String?, body: String?): Boolean {
        if (body == null) return false
        val lowerBody = body.lowercase()

        // Basic heuristic: must contain a money keyword
        val hasKeyword = smsKeywords.any { lowerBody.contains(it) }

        // And usually contains "INR" or "Rs"
        val hasCurrency = lowerBody.contains("inr") || lowerBody.contains("rs") || lowerBody.contains("₹")

        return hasKeyword && hasCurrency
    }
}
