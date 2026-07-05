package com.monflo.tracking

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Schedules the capture watchdog. WorkManager survives reboot, app-swipe and Doze, and is the
 * OEM-respected way to re-arm a killed capture service.
 */
object CaptureWatchdog {
    const val PERIODIC_WORK = "monflo_capture_watchdog"
    const val KICK_WORK = "monflo_capture_kick"
    const val INTERVAL_MINUTES = 15L

    fun schedule(ctx: Context) {
        val request = PeriodicWorkRequestBuilder<CaptureWatchdogWorker>(
            INTERVAL_MINUTES, TimeUnit.MINUTES
        ).build()
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request
        )
    }

    /** Immediate re-assert (e.g. after the app is swiped from recents). */
    fun kickNow(ctx: Context) {
        val request = OneTimeWorkRequestBuilder<CaptureWatchdogWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(
            KICK_WORK, ExistingWorkPolicy.KEEP, request
        )
    }

    fun cancel(ctx: Context) {
        WorkManager.getInstance(ctx).cancelUniqueWork(PERIODIC_WORK)
    }

    /** Guarded foreground-service start — startForegroundService is API 26+. */
    fun ensureServiceRunning(ctx: Context) {
        val intent = Intent(ctx, MonfloNotificationService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }
}
