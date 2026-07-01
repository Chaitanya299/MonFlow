package com.monflo.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
            if (prefs.getBoolean("isTrackingEnabled", false)) {
                val serviceIntent = Intent(context, MonfloNotificationService::class.java)
                context.startForegroundService(serviceIntent)
                CaptureWatchdogWorker.schedulePeriodic(context)
            }
        }
    }
}
