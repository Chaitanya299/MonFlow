package com.monflo.tracking

import android.content.Context

/**
 * Shared proof-of-life timestamp for the capture pipeline. Written by the
 * notification service (on connect + on every alert) and read by the
 * watchdog worker and the JS bridge, so a stale value reliably means the
 * service's process died without the OS restarting it — not just "no bank
 * alerts happened to arrive."
 */
object Heartbeat {
    private const val PREFS_NAME = "monflo_tracking_prefs"
    private const val KEY_LAST_HEARTBEAT_MS = "lastHeartbeatMs"
    private const val KEY_LAST_WATCHDOG_RUN_MS = "lastWatchdogRunMs"

    // Above WorkManager's 15-minute periodic minimum to absorb scheduling jitter.
    const val STALE_THRESHOLD_MS = 20 * 60 * 1000L

    fun touch(context: Context) {
        prefs(context).edit().putLong(KEY_LAST_HEARTBEAT_MS, System.currentTimeMillis()).apply()
    }

    fun lastHeartbeatMs(context: Context): Long =
        prefs(context).getLong(KEY_LAST_HEARTBEAT_MS, 0L)

    fun touchWatchdog(context: Context) {
        prefs(context).edit().putLong(KEY_LAST_WATCHDOG_RUN_MS, System.currentTimeMillis()).apply()
    }

    fun lastWatchdogRunMs(context: Context): Long =
        prefs(context).getLong(KEY_LAST_WATCHDOG_RUN_MS, 0L)

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
