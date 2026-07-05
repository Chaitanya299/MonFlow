package com.monflo.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            // Full reboot, direct-boot, vendor quickboot, and app-update — all need capture re-armed.
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                val prefs = context.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
                if (prefs.getBoolean("isTrackingEnabled", false)) {
                    CaptureWatchdog.ensureServiceRunning(context)
                    CaptureWatchdog.schedule(context)
                }
            }
        }
    }
}
