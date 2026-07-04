package com.monflo.tracking

import android.content.ComponentName
import android.content.Context
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

    override fun onListenerConnected() {
        CaptureHealth.recordListenerConnected(applicationContext)
        // Backfill: capture any financial alerts still on-screen that we missed while disconnected.
        val active = try { activeNotifications } catch (e: Exception) { null }
        active?.forEach { handleNotification(it) }
    }

    override fun onListenerDisconnected() {
        // Android disconnects the listener routinely on OEM devices and never reconnects on its
        // own — ask the platform to rebind us.
        requestRebind(componentName(applicationContext))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        CaptureHealth.recordAlive(applicationContext)
        handleNotification(sbn)
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Many OEMs kill capture when the app is swiped from recents — re-assert immediately.
        CaptureWatchdog.kickNow(applicationContext)
        super.onTaskRemoved(rootIntent)
    }

    private fun handleNotification(sbn: StatusBarNotification) {
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

    companion object {
        fun componentName(ctx: Context): ComponentName =
            ComponentName(ctx, MonfloNotificationService::class.java)
    }
}
