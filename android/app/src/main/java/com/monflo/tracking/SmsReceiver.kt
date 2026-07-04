package com.monflo.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmsReceiver : BroadcastReceiver() {
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        // Capture-mode gate: skip when the direct SMS-receiver source is disabled
        if (!CaptureConfig.isSmsReceiverEnabled(context)) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (sms in messages) {
            val sender = sms.originatingAddress
            val body = sms.messageBody

            if (AlertFilter.isRelevantSms(sender, body)) {
                processSms(context, body, sender ?: "Unknown")
            }
        }
    }

    private fun processSms(context: Context, text: String, sender: String) {
        scope.launch {
            if (DeduplicationBuffer.isDuplicate(context, text)) return@launch

            val headerType = AlertFilter.analyzeHeader(sender)

            // SECURITY: If it's a promotional message per TRAI, ignore it entirely
            if (headerType == "PROMOTIONAL") return@launch

            val database = NativeDatabase.getInstance(context)
            val alert = RawAlert(
                rawText = text,
                packageName = "sms:$sender", // Full header preserved for JS analysis
                timestamp = System.currentTimeMillis()
            )
            database.rawAlertDao().insert(alert)
        }
    }
}
