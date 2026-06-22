package com.monflo.tracking

import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MonfloNotificationService : NotificationListenerService() {
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        NotificationHelper.createNotificationChannel(this)
        startForeground(1, NotificationHelper.buildNotification(this))
        return START_STICKY
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val text = AlertFilter.extractNotificationText(sbn.packageName, sbn.notification.extras) ?: return

        scope.launch {
            if (DeduplicationBuffer.isDuplicate(applicationContext, text)) return@launch
            saveToVault(text, sbn.packageName)
        }
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
