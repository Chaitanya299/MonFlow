package com.monflo.tracking

import android.content.Context

object DeduplicationBuffer {
    private const val WINDOW_MS = 60_000L // 60 seconds

    /**
     * Checks if a similar alert (same text) was captured recently.
     * Prevents double-counting between Notification and SMS fallbacks.
     */
    suspend fun isDuplicate(context: Context, text: String): Boolean {
        val database = NativeDatabase.getInstance(context)
        val sinceMs = System.currentTimeMillis() - WINDOW_MS

        // Check in raw alerts
        val count = database.rawAlertDao().countSimilar(text, sinceMs)
        return count > 0
    }
}
