package com.monflo.tracking

import android.content.Context
import android.content.SharedPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyString
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`

class CaptureConfigTest {

    /** Builds a Context whose SharedPreferences reports the given capture mode. */
    private fun contextForMode(mode: String): Context {
        val prefs = mock(SharedPreferences::class.java)
        `when`(prefs.getString(anyString(), anyString())).thenReturn(mode)
        val ctx = mock(Context::class.java)
        `when`(ctx.getSharedPreferences(anyString(), anyInt())).thenReturn(prefs)
        return ctx
    }

    @Test
    fun `NOTIF_ONLY enables only app notifications`() {
        val ctx = contextForMode(CaptureConfig.MODE_NOTIF_ONLY)
        assertTrue(CaptureConfig.isAppNotifEnabled(ctx))
        assertFalse(CaptureConfig.isBankSmsNotifEnabled(ctx))
        assertFalse(CaptureConfig.isSmsReceiverEnabled(ctx))
    }

    @Test
    fun `BANK_SMS_NOTIF_ONLY enables only the messages-app SMS path`() {
        val ctx = contextForMode(CaptureConfig.MODE_BANK_SMS_NOTIF_ONLY)
        assertFalse(CaptureConfig.isAppNotifEnabled(ctx))
        assertTrue(CaptureConfig.isBankSmsNotifEnabled(ctx))
        assertFalse(CaptureConfig.isSmsReceiverEnabled(ctx))
    }

    @Test
    fun `SMS_RECEIVER_ONLY enables only the broadcast receiver`() {
        val ctx = contextForMode(CaptureConfig.MODE_SMS_RECEIVER_ONLY)
        assertFalse(CaptureConfig.isAppNotifEnabled(ctx))
        assertFalse(CaptureConfig.isBankSmsNotifEnabled(ctx))
        assertTrue(CaptureConfig.isSmsReceiverEnabled(ctx))
    }

    @Test
    fun `ALL enables every source`() {
        val ctx = contextForMode(CaptureConfig.MODE_ALL)
        assertTrue(CaptureConfig.isAppNotifEnabled(ctx))
        assertTrue(CaptureConfig.isBankSmsNotifEnabled(ctx))
        assertTrue(CaptureConfig.isSmsReceiverEnabled(ctx))
    }

    @Test
    fun `getMode falls back to ALL when unset`() {
        val prefs = mock(SharedPreferences::class.java)
        // Room/prefs return the supplied default when the key is missing
        `when`(prefs.getString(anyString(), anyString())).thenAnswer { it.getArgument(1) }
        val ctx = mock(Context::class.java)
        `when`(ctx.getSharedPreferences(anyString(), anyInt())).thenReturn(prefs)
        assertEquals(CaptureConfig.MODE_ALL, CaptureConfig.getMode(ctx))
    }
}
