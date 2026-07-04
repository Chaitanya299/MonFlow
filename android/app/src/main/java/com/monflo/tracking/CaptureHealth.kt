package com.monflo.tracking

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Heartbeat + gap state for the capture service, backed by SharedPreferences.
 *
 * ponytail: SharedPreferences (single writer) instead of a Room table — avoids a DB v4
 * migration for a handful of scalars + a capped gap list. Upgrade to a table only if we
 * ever need gap history/querying beyond the last MAX_GAPS.
 */
object CaptureHealth {
    private const val PREFS = "monflo_capture_health"
    private const val K_LISTENER_CONNECTED = "lastListenerConnectedMs"
    private const val K_ALIVE = "lastAliveMs"
    private const val K_WATCHDOG_TICK = "lastWatchdogTickMs"
    private const val K_ACCESS_GRANTED = "accessGranted"
    private const val K_GAPS = "gaps"
    private const val MAX_GAPS = 20

    const val REASON_BACKGROUND_SUPPRESSED = "BACKGROUND_SUPPRESSED"
    const val REASON_ACCESS_REVOKED = "ACCESS_REVOKED"

    data class Gap(
        val startMs: Long,
        val endMs: Long,
        val reason: String,
        val acknowledged: Boolean = false
    )

    // --- Pure helpers (framework-free, unit-tested) ---

    /**
     * A gap exists when the watchdog should have ticked but didn't: the device suppressed our
     * background execution for [nowMs] - [prevTickMs] > [intervalMs] + [slackMs]. Returns null on
     * first run (prevTickMs <= 0) or when ticks are on schedule.
     */
    fun computeGap(prevTickMs: Long, nowMs: Long, intervalMs: Long, slackMs: Long): Gap? {
        if (prevTickMs <= 0L) return null
        if (nowMs - prevTickMs <= intervalMs + slackMs) return null
        return Gap(prevTickMs, nowMs, REASON_BACKGROUND_SUPPRESSED)
    }

    fun isAccessGranted(enabledPackages: Set<String>, pkg: String): Boolean =
        enabledPackages.contains(pkg)

    fun serializeGaps(gaps: List<Gap>): String {
        val arr = JSONArray()
        for (g in gaps) {
            arr.put(
                JSONObject()
                    .put("startMs", g.startMs)
                    .put("endMs", g.endMs)
                    .put("reason", g.reason)
                    .put("acknowledged", g.acknowledged)
            )
        }
        return arr.toString()
    }

    fun parseGaps(json: String?): List<Gap> {
        if (json.isNullOrBlank()) return emptyList()
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Gap(
                    startMs = o.getLong("startMs"),
                    endMs = o.getLong("endMs"),
                    reason = o.getString("reason"),
                    acknowledged = o.optBoolean("acknowledged", false)
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** Newest-first, capped at [MAX_GAPS]. */
    fun appendGap(existing: List<Gap>, gap: Gap): List<Gap> =
        (listOf(gap) + existing).take(MAX_GAPS)

    // --- Prefs-backed recorders (impure) ---

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun recordListenerConnected(ctx: Context) {
        val now = System.currentTimeMillis()
        prefs(ctx).edit()
            .putLong(K_LISTENER_CONNECTED, now)
            .putLong(K_ALIVE, now)
            .putBoolean(K_ACCESS_GRANTED, true)
            .apply()
    }

    fun recordAlive(ctx: Context) {
        prefs(ctx).edit().putLong(K_ALIVE, System.currentTimeMillis()).apply()
    }

    fun recordWatchdogTick(ctx: Context, nowMs: Long) {
        prefs(ctx).edit().putLong(K_WATCHDOG_TICK, nowMs).apply()
    }

    fun lastWatchdogTickMs(ctx: Context): Long = prefs(ctx).getLong(K_WATCHDOG_TICK, 0L)
    fun lastListenerConnectedMs(ctx: Context): Long = prefs(ctx).getLong(K_LISTENER_CONNECTED, 0L)
    fun lastAliveMs(ctx: Context): Long = prefs(ctx).getLong(K_ALIVE, 0L)

    fun wasAccessGranted(ctx: Context): Boolean = prefs(ctx).getBoolean(K_ACCESS_GRANTED, false)
    fun setAccessGranted(ctx: Context, granted: Boolean) {
        prefs(ctx).edit().putBoolean(K_ACCESS_GRANTED, granted).apply()
    }

    fun getGaps(ctx: Context): List<Gap> = parseGaps(prefs(ctx).getString(K_GAPS, null))

    fun addGap(ctx: Context, gap: Gap) {
        val updated = appendGap(getGaps(ctx), gap)
        prefs(ctx).edit().putString(K_GAPS, serializeGaps(updated)).apply()
    }

    fun acknowledgeAll(ctx: Context) {
        val acked = getGaps(ctx).map { it.copy(acknowledged = true) }
        prefs(ctx).edit().putString(K_GAPS, serializeGaps(acked)).apply()
    }
}
