package com.monflo.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureHealthTest {

    private val intervalMs = 15 * 60_000L
    private val slackMs = 20 * 60_000L // threshold = 35 min

    @Test
    fun `computeGap returns null on first run`() {
        assertNull(CaptureHealth.computeGap(0L, 100_000L, intervalMs, slackMs))
    }

    @Test
    fun `computeGap returns null when ticks are on schedule`() {
        val now = 1_000_000L
        val prev = now - 10 * 60_000L // 10 min < 35 min threshold
        assertNull(CaptureHealth.computeGap(prev, now, intervalMs, slackMs))
    }

    @Test
    fun `computeGap returns a gap when background was suppressed`() {
        val now = 10_000_000L
        val prev = now - 90 * 60_000L // 90 min >> 35 min
        val gap = CaptureHealth.computeGap(prev, now, intervalMs, slackMs)
        assertNotNull(gap)
        assertEquals(prev, gap!!.startMs)
        assertEquals(now, gap.endMs)
        assertEquals(CaptureHealth.REASON_BACKGROUND_SUPPRESSED, gap.reason)
        assertFalse(gap.acknowledged)
    }

    @Test
    fun `isAccessGranted checks membership`() {
        assertTrue(CaptureHealth.isAccessGranted(setOf("com.monflo"), "com.monflo"))
        assertFalse(CaptureHealth.isAccessGranted(setOf("com.other"), "com.monflo"))
        assertFalse(CaptureHealth.isAccessGranted(emptySet(), "com.monflo"))
    }

    @Test
    fun `gaps survive a serialize-parse round trip`() {
        val gaps = listOf(
            CaptureHealth.Gap(1L, 2L, CaptureHealth.REASON_BACKGROUND_SUPPRESSED, false),
            CaptureHealth.Gap(3L, 4L, CaptureHealth.REASON_ACCESS_REVOKED, true)
        )
        val parsed = CaptureHealth.parseGaps(CaptureHealth.serializeGaps(gaps))
        assertEquals(gaps, parsed)
    }

    @Test
    fun `parseGaps tolerates null, blank and garbage`() {
        assertTrue(CaptureHealth.parseGaps(null).isEmpty())
        assertTrue(CaptureHealth.parseGaps("").isEmpty())
        assertTrue(CaptureHealth.parseGaps("not json").isEmpty())
    }

    @Test
    fun `appendGap is newest-first and capped at 20`() {
        var list = emptyList<CaptureHealth.Gap>()
        for (i in 1..25) {
            list = CaptureHealth.appendGap(list, CaptureHealth.Gap(i.toLong(), i.toLong(), "R", false))
        }
        assertEquals(20, list.size)
        assertEquals(25L, list.first().startMs) // newest kept
        assertEquals(6L, list.last().startMs)   // oldest 5 dropped
    }
}
