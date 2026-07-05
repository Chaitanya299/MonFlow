package com.monflo.tracking

import android.os.Bundle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock

class NotificationCaptureTest {

    @Test
    fun `test allowlist filtering - unknown package should return null`() {
        val result = AlertFilter.extractNotificationText("com.random.app", null)
        assertNull("Unknown package should be ignored", result)
    }

    @Test
    fun `test allowlist filtering - GPay should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Paid ₹500 to Rahul")

        val result = AlertFilter.extractNotificationText("com.google.android.apps.nbu.paisa.user", extras)
        assertEquals("GPay notification should be accepted", "Paid ₹500 to Rahul", result)
    }

    @Test
    fun `test allowlist filtering - PhonePe should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("₹200 received from Priya")

        val result = AlertFilter.extractNotificationText("com.phonepe.app", extras)
        assertEquals("PhonePe notification should be accepted", "₹200 received from Priya", result)
    }

    @Test
    fun `test allowlist filtering - Paytm should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Cashback of ₹50 received")

        val result = AlertFilter.extractNotificationText("net.one97.paytm", extras)
        assertEquals("Paytm notification should be accepted", "Cashback of ₹50 received", result)
    }

    @Test
    fun `test allowlist filtering - stale GPay id without user suffix should be rejected`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Paid ₹500 to Rahul")

        val result = AlertFilter.extractNotificationText("com.google.android.apps.nbu.paisa", extras)
        assertNull("Old incomplete GPay package id must not match", result)
    }

    @Test
    fun `test missing text - null extras should return null`() {
        val result = AlertFilter.extractNotificationText("com.phonepe.app", null)
        assertNull("Null extras should return null", result)
    }

    @Test
    fun `test missing text - missing android_text key should return null`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn(null)

        val result = AlertFilter.extractNotificationText("com.phonepe.app", extras)
        assertNull("Missing android.text should return null", result)
    }

    @Test
    fun `test short text - text shorter than 5 chars should be ignored`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Hi")

        val result = AlertFilter.extractNotificationText("com.phonepe.app", extras)
        assertNull("Short text should be ignored", result)
    }

    @Test
    fun `test valid text - text exactly 5 chars should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Paid1")

        val result = AlertFilter.extractNotificationText("com.phonepe.app", extras)
        assertEquals("Text with 5 chars should be accepted", "Paid1", result)
    }

    @Test
    fun `test big text preferred - full body should win over truncated text`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Rs.500 debited from A/c...")
        `when`(extras.getCharSequence("android.bigText"))
            .thenReturn("Rs.500 debited from A/c XX1234 on 02-Jul-26 UPI Ref 123456789")

        val result = AlertFilter.extractNotificationText("com.phonepe.app", extras)
        assertEquals(
            "Full bigText body should be used when present",
            "Rs.500 debited from A/c XX1234 on 02-Jul-26 UPI Ref 123456789",
            result
        )
    }

    @Test
    fun `test sms app - bank debit SMS notification should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("VM-HDFCBK-S")
        `when`(extras.getCharSequence("android.text")).thenReturn("Rs.500 debited from A/c XX1234")

        val result = AlertFilter.extractNotificationText("com.google.android.apps.messaging", extras)
        assertEquals("Bank SMS via Google Messages should be accepted", "Rs.500 debited from A/c XX1234", result)
    }

    @Test
    fun `test sms app - bank credit SMS notification should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("AX-SBIINB-S")
        `when`(extras.getCharSequence("android.text")).thenReturn("INR 25,000 credited to A/c XX1234 by NEFT")

        val result = AlertFilter.extractNotificationText("com.samsung.android.messaging", extras)
        assertEquals(
            "Bank credit SMS via Samsung Messages should be accepted",
            "INR 25,000 credited to A/c XX1234 by NEFT",
            result
        )
    }

    @Test
    fun `test sms app - personal SMS notification should be rejected`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("Amma")
        `when`(extras.getCharSequence("android.text")).thenReturn("Are you coming home for dinner tonight?")

        val result = AlertFilter.extractNotificationText("com.google.android.apps.messaging", extras)
        assertNull("Personal SMS must never enter the vault", result)
    }

    @Test
    fun `test pure payment apps - BHIM super_money and Navi should be accepted raw`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.text")).thenReturn("Paid ₹250 to Auto")

        for (pkg in setOf("in.org.npci.upiapp", "money.super.payments", "com.naviapp")) {
            val result = AlertFilter.extractNotificationText(pkg, extras)
            assertEquals("$pkg is a pure payment app and should capture raw", "Paid ₹250 to Auto", result)
        }
    }

    @Test
    fun `test mixed app - WhatsApp payment notification should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("Rahul Sharma")
        `when`(extras.getCharSequence("android.text")).thenReturn("You sent ₹500 to Rahul Sharma")

        val result = AlertFilter.extractNotificationText("com.whatsapp", extras)
        assertEquals("WhatsApp Pay notification should be captured", "You sent ₹500 to Rahul Sharma", result)
    }

    @Test
    fun `test mixed app - WhatsApp personal message must never enter the vault`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("Amma")
        `when`(extras.getCharSequence("android.text")).thenReturn("Are you coming home for dinner?")

        val result = AlertFilter.extractNotificationText("com.whatsapp", extras)
        assertNull("Personal WhatsApp chat must be gated out", result)
    }

    @Test
    fun `test mixed app - Amazon delivery notification should be rejected`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("Amazon")
        `when`(extras.getCharSequence("android.text")).thenReturn("Your order has been shipped and arrives today")

        val result = AlertFilter.extractNotificationText("in.amazon.mShop.android.shopping", extras)
        assertNull("Amazon shipping/delivery notifications must not be captured as spends", result)
    }

    @Test
    fun `test mixed app - CRED bill payment should be accepted`() {
        val extras = mock(Bundle::class.java)
        `when`(extras.getCharSequence("android.title")).thenReturn("CRED")
        `when`(extras.getCharSequence("android.text")).thenReturn("₹12,500 paid towards your HDFC Credit Card")

        val result = AlertFilter.extractNotificationText("com.dreamplug.androidapp", extras)
        assertEquals("CRED payment should be captured", "₹12,500 paid towards your HDFC Credit Card", result)
    }

    @Test
    fun `test relevance filter - credit keywords should be relevant`() {
        assertTrue(
            "Credit alerts must pass the SMS relevance filter",
            AlertFilter.isRelevantSms("VM-HDFCBK-S", "Rs.25000 credited to A/c XX1234 by NEFT")
        )
        assertTrue(
            "ATM withdrawal alerts must pass the SMS relevance filter",
            AlertFilter.isRelevantSms("VM-SBIINB-S", "Rs.2000 withdrawn at ATM from A/c XX1234")
        )
        assertFalse(
            "Money keyword without currency should stay irrelevant",
            AlertFilter.isRelevantSms("Amma", "I sent you the photos from the wedding")
        )
    }
}
