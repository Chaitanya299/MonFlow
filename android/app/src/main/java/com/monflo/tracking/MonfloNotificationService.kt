package com.monflo.tracking

import android.content.ComponentName
import android.content.Intent
import android.os.Build
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        NotificationHelper.createNotificationChannel(this)
        startForeground(1, NotificationHelper.buildNotification(this))
        return START_STICKY
    }

    override fun onListenerDisconnected() {
        // OEM battery managers (MIUI/ColorOS/FuntouchOS) unbind listeners silently;
        // ask the system to rebind so capture resumes without user intervention
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            requestRebind(ComponentName(this, MonfloNotificationService::class.java))
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
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
