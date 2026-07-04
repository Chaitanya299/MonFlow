package com.monflo.tracking

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.monflo.BuildConfig
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MonfloNotificationService : NotificationListenerService() {
    private val scope = CoroutineScope(Dispatchers.IO)

    // lazy, not lateinit: after requestRebind the system binds the listener without
    // calling onStartCommand, so initialization there would leave this unset
    private val bridge by lazy { MonfloBridgeService(this) }

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            requestRebind(ComponentName(this, MonfloNotificationService::class.java))
        }
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
        val pkg = sbn.packageName
        val isBankSmsNotif = AlertFilter.smsAppAllowlist.contains(pkg)
        val isAppNotif = AlertFilter.notificationAllowlist.contains(pkg) ||
            AlertFilter.relevanceGatedAllowlist.contains(pkg)
        if (!isBankSmsNotif && !isAppNotif) return

        // Capture-mode gate: skip sources the current test mode has disabled
        val sourceEnabled = if (isBankSmsNotif) {
            CaptureConfig.isBankSmsNotifEnabled(applicationContext)
        } else {
            CaptureConfig.isAppNotifEnabled(applicationContext)
        }
        if (!sourceEnabled) return

        val text = AlertFilter.extractNotificationText(pkg, sbn.notification.extras) ?: return

        scope.launch {
            if (DeduplicationBuffer.isDuplicate(applicationContext, text)) return@launch
            val sender = extractSender(sbn)
            // Bank SMS seen via the SMS app's notification follows SmsReceiver's
            // "sms:<sender>" convention so the JS parser applies TRAI trust analysis
            val sourcePackage = if (isBankSmsNotif) "sms:$sender" else pkg
            saveToVault(text, sourcePackage)
            // Dev tooling only: mirror alerts to the Mac receiver. Must never run in
            // release — the app's privacy claim is that data never leaves the device.
            if (BuildConfig.DEBUG) {
                bridge.postAlert(sender, text)
            }
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
