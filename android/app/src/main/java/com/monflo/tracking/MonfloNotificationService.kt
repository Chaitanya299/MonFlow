package com.monflo.tracking

import android.content.ComponentName
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MonfloNotificationService : NotificationListenerService() {
    private val scope = CoroutineScope(Dispatchers.IO)
    private lateinit var bridge: MonfloBridgeService
    private val heartbeatHandler = Handler(Looper.getMainLooper())
    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            Heartbeat.touch(applicationContext)
            heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
        }
    }

    companion object {
        private const val HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000L
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        NotificationHelper.createNotificationChannel(this)
        startForeground(1, NotificationHelper.buildNotification(this))
        bridge = MonfloBridgeService(this)
        return START_STICKY
    }

    // The clearest proof-of-life signal — fires whenever the system (re)binds
    // the listener, including after a disconnect the OS resolved on its own.
    override fun onListenerConnected() {
        super.onListenerConnected()
        Heartbeat.touch(applicationContext)
        heartbeatHandler.removeCallbacks(heartbeatRunnable)
        heartbeatHandler.post(heartbeatRunnable)
    }

    // The system disconnects listeners more often than expected (OEM power
    // management, permission re-grants, system_server restarts). Without an
    // explicit rebind request a disconnected listener can stay dead until the
    // next full boot, silently ending capture with no visible sign to the user.
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        heartbeatHandler.removeCallbacks(heartbeatRunnable)
        requestRebind(ComponentName(this, MonfloNotificationService::class.java))
    }

    // OEM battery killers can still tear down the whole process. Hand off to
    // WorkManager for a fresh-context restart check rather than restarting
    // directly from a process that's already mid-teardown.
    override fun onDestroy() {
        super.onDestroy()
        heartbeatHandler.removeCallbacks(heartbeatRunnable)
        CaptureWatchdogWorker.runOnce(applicationContext)
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        CaptureWatchdogWorker.runOnce(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        Heartbeat.touch(applicationContext)
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
