package com.monflo.tracking

import android.content.Context

/**
 * Controls which capture sources are active. Persisted in SharedPreferences so the
 * background NotificationListenerService and SmsReceiver honor it even when the RN
 * layer is not running.
 *
 * Testing modes (set one, leave it for a day, then export and review accuracy):
 *  - NOTIF_ONLY           : app notifications only (UPI apps + mixed apps)
 *  - BANK_SMS_NOTIF_ONLY  : bank SMS read from the Messages app's notification
 *  - SMS_RECEIVER_ONLY    : direct SMS broadcast receiver
 *  - ALL                  : all three (default; production behavior)
 *
 * The three sources map onto capture points:
 *  APP_NOTIF       -> MonfloNotificationService for notificationAllowlist/relevanceGatedAllowlist packages
 *  BANK_SMS_NOTIF  -> MonfloNotificationService for smsAppAllowlist packages
 *  SMS_RECEIVER    -> SmsReceiver broadcast
 */
object CaptureConfig {
    private const val PREFS = "monflo_capture_prefs"
    private const val KEY_MODE = "capture_mode"

    const val MODE_NOTIF_ONLY = "NOTIF_ONLY"
    const val MODE_ALL = "ALL"
    const val MODE_BANK_SMS_NOTIF_ONLY = "BANK_SMS_NOTIF_ONLY"
    const val MODE_SMS_RECEIVER_ONLY = "SMS_RECEIVER_ONLY"

    private val VALID_MODES = setOf(
        MODE_NOTIF_ONLY, MODE_ALL, MODE_BANK_SMS_NOTIF_ONLY, MODE_SMS_RECEIVER_ONLY
    )

    fun getMode(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_MODE, MODE_ALL) ?: MODE_ALL

    /** Unknown modes fall back to ALL so a bad value can never silence all capture. */
    fun setMode(context: Context, mode: String) {
        val safe = if (VALID_MODES.contains(mode)) mode else MODE_ALL
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_MODE, safe).apply()
    }

    fun isAppNotifEnabled(context: Context): Boolean =
        getMode(context).let { it == MODE_ALL || it == MODE_NOTIF_ONLY }

    fun isBankSmsNotifEnabled(context: Context): Boolean =
        getMode(context).let { it == MODE_ALL || it == MODE_BANK_SMS_NOTIF_ONLY }

    fun isSmsReceiverEnabled(context: Context): Boolean =
        getMode(context).let { it == MODE_ALL || it == MODE_SMS_RECEIVER_ONLY }
}
