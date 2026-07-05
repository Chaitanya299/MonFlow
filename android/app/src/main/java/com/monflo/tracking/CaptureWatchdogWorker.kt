package com.monflo.tracking

import android.content.Context
import android.os.Build
import android.service.notification.NotificationListenerService
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Periodic liveness check that re-arms capture and records gaps.
 *
 * ponytail: gap detection = "did our own watchdog tick on schedule?" plus "is listener access
 * still granted?". This catches the dominant OEM-kill failure (background execution suppressed)
 * and user/system revocation. It does NOT catch a process that is alive but whose listener
 * silently stopped delivering — add a self-test notification ping only if that shows up on real devices.
 */
class CaptureWatchdogWorker(
    ctx: Context,
    params: WorkerParameters
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val now = System.currentTimeMillis()
        val intervalMs = TimeUnit.MINUTES.toMillis(CaptureWatchdog.INTERVAL_MINUTES)
        val slackMs = TimeUnit.MINUTES.toMillis(20)

        var newGapMessage: String? = null

        // 1. Background-suppression gap: the watchdog should have ticked but didn't.
        CaptureHealth.computeGap(CaptureHealth.lastWatchdogTickMs(ctx), now, intervalMs, slackMs)
            ?.let {
                CaptureHealth.addGap(ctx, it)
                newGapMessage = "Capture was paused — some transactions may be missing. Open Monflo to check."
            }

        // 2. Notification-access check + proactive rebind.
        val enabled = NotificationManagerCompat.getEnabledListenerPackages(ctx)
        val granted = CaptureHealth.isAccessGranted(enabled, ctx.packageName)
        if (granted) {
            // requestRebind is API 24+; on older devices the system keeps the binding itself.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                NotificationListenerService.requestRebind(MonfloNotificationService.componentName(ctx))
            }
        } else if (CaptureHealth.wasAccessGranted(ctx)) {
            val from = CaptureHealth.lastListenerConnectedMs(ctx).takeIf { it > 0 } ?: now
            CaptureHealth.addGap(ctx, CaptureHealth.Gap(from, now, CaptureHealth.REASON_ACCESS_REVOKED))
            newGapMessage = "Capture is off — notification access was turned off. Tap to re-enable."
        }
        CaptureHealth.setAccessGranted(ctx, granted)

        // 3. Keep the foreground service warm while tracking is on.
        if (isTrackingEnabled(ctx)) {
            CaptureWatchdog.ensureServiceRunning(ctx)
        }

        // 4. Record this tick — it defines the next gap window.
        CaptureHealth.recordWatchdogTick(ctx, now)

        // 5. Tell the user a gap opened (best-effort; no-op without POST_NOTIFICATIONS).
        newGapMessage?.let { NotificationHelper.postGapAlert(ctx, it) }

        return Result.success()
    }

    private fun isTrackingEnabled(ctx: Context): Boolean =
        ctx.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
            .getBoolean("isTrackingEnabled", false)
}
