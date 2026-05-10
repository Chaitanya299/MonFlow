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

    private val allowlist = setOf(
        "com.google.android.apps.nbu.paisa", // GPay
        "com.phonepe.app",
        "com.paytm.app"
    )

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!allowlist.contains(sbn.packageName)) return

        val text = sbn.notification.extras.getCharSequence("android.text")?.toString() ?: return
        if (text.length < 5) return

        saveToVault(text, sbn.packageName)
    }

    private fun saveToVault(text: String, pkg: String) {
        scope.launch {
            val database = NativeDatabase.getInstance(applicationContext)
            val alert = RawAlert(
                rawText = text,
                packageName = pkg,
                timestamp = System.currentTimeMillis()
            )
            database.rawAlertDao().insert(alert)
        }
    }
}
