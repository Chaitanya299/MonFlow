package com.monflo.tracking

import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Periodic self-heal for OEM battery killers (Xiaomi/Samsung/Oppo/Vivo routinely
 * kill notification-listener processes outright). If tracking is enabled and
 * notification access is still granted but the heartbeat has gone stale, the
 * process died without the OS restarting it — re-launching the foreground
 * service is a no-op if it's already alive, so this is safe to run unconditionally.
 */
class CaptureWatchdogWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val UNIQUE_PERIODIC_NAME = "monflo_capture_watchdog"
        private const val UNIQUE_ONE_TIME_NAME = "monflo_capture_watchdog_immediate"

        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<CaptureWatchdogWorker>(15, TimeUnit.MINUTES).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }

        fun cancelPeriodic(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_PERIODIC_NAME)
        }

        // Fired from onDestroy/onTaskRemoved for an immediate check rather than
        // waiting up to 15 minutes for the next periodic tick.
        fun runOnce(context: Context) {
            val request = OneTimeWorkRequestBuilder<CaptureWatchdogWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, request
            )
        }
    }

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        Heartbeat.touchWatchdog(ctx)

        val prefs = ctx.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("isTrackingEnabled", false)) return Result.success()

        val listenerEnabled = NotificationManagerCompat
            .getEnabledListenerPackages(ctx)
            .contains(ctx.packageName)
        if (!listenerEnabled) return Result.success() // nothing to do without user re-granting

        val gap = System.currentTimeMillis() - Heartbeat.lastHeartbeatMs(ctx)
        if (gap > Heartbeat.STALE_THRESHOLD_MS) {
            ctx.startForegroundService(Intent(ctx, MonfloNotificationService::class.java))
        }
        return Result.success()
    }
}
