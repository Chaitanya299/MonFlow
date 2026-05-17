package com.monflo.tracking

import android.os.Bundle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock

class NotificationCaptureTest {

    @Test
    fun `test allowlist filtering - unknown package should return null`() {
        val result = MonfloNotificationService.extractText("com.random.app", null)
        assertNull("Unknown package should be ignored", result)
    }

    @Test
    fun `test allowlist filtering - GPay should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Paid ₹500 to Rahul")

        val result = MonfloNotificationService.extractText("com.google.android.apps.nbu.paisa", extras)
        assertEquals("GPay notification should be accepted", "Paid ₹500 to Rahul", result)
    }

    @Test
    fun `test allowlist filtering - PhonePe should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("₹200 received from Priya")

        val result = MonfloNotificationService.extractText("com.phonepe.app", extras)
        assertEquals("PhonePe notification should be accepted", "₹200 received from Priya", result)
    }

    @Test
    fun `test allowlist filtering - Paytm should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Cashback of ₹50 received")

        val result = MonfloNotificationService.extractText("com.paytm.app", extras)
        assertEquals("Paytm notification should be accepted", "Cashback of ₹50 received", result)
    }

    @Test
    fun `test missing text - null extras should return null`() {
        val result = MonfloNotificationService.extractText("com.phonepe.app", null)
        assertNull("Null extras should return null", result)
    }

    @Test
    fun `test missing text - missing android_text key should return null`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn(null)

        val result = MonfloNotificationService.extractText("com.phonepe.app", extras)
        assertNull("Missing android.text should return null", result)
    }

    @Test
    fun `test short text - text shorter than 5 chars should be ignored`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Hi")

        val result = MonfloNotificationService.extractText("com.phonepe.app", extras)
        assertNull("Short text should be ignored", result)
    }

    @Test
    fun `test valid text - text exactly 5 chars should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Paid1")

        val result = MonfloNotificationService.extractText("com.phonepe.app", extras)
        assertEquals("Text with 5 chars should be accepted", "Paid1", result)
    }
}
