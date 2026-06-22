package com.monflo.tracking

import android.os.Bundle

object AlertFilter {
    val notificationAllowlist = setOf(
        "com.google.android.apps.nbu.paisa", // GPay
        "com.phonepe.app",
        "com.paytm.app"
    )

    // SMS filters for common Indian bank identifiers
    private val smsKeywords = setOf("debited", "spent", "sent", "transaction", "paid")

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
        if (!notificationAllowlist.contains(packageName)) return null
        val text = extras?.getCharSequence("android.text")?.toString() ?: return null
        if (text.length < 5) return null
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
