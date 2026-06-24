package com.monflo.tracking

import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MonfloNotificationService : NotificationListenerService() {
    private val scope = CoroutineScope(Dispatchers.IO)
    private lateinit var bridge: MonfloBridgeService

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        NotificationHelper.createNotificationChannel(this)
        startForeground(1, NotificationHelper.buildNotification(this))
        bridge = MonfloBridgeService(this)
        return START_STICKY
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val text = AlertFilter.extractNotificationText(sbn.packageName, sbn.notification.extras) ?: return

        scope.launch {
            if (DeduplicationBuffer.isDuplicate(applicationContext, text)) return@launch
            val sender = extractSender(sbn)
            saveToVault(text, sbn.packageName)
            bridge.postAlert(sender, text)
        }
    }

    private fun extractSender(sbn: StatusBarNotification): String {
        return sbn.notification.extras.getString("android.title") ?: sbn.packageName ?: "Unknown"
    }

    private fun saveToVault(text: String, pkg: String) {
        val database = NativeDatabase.getInstance(applicationContext)
        val alert = RawAlert(
            rawText = text,
            packageName = pkg,
            timestamp = System.currentTimeMillis()
        )
        database.rawAlertDao().insert(alert)
    }
}
