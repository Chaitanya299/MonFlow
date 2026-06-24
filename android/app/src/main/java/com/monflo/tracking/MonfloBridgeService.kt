package com.monflo.tracking

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Bridges Android SMS/notification captures to a remote Mac receiver endpoint.
 *
 * Supports:
 * - POST to configurable receiver URL (e.g. http://mac-ip:3456/capture)
 * - Graceful fallback if receiver is offline
 * - Local retry queue for failed sends
 * - Configurable via SharedPreferences
 */
class MonfloBridgeService(private val context: Context) {
    companion object {
        private const val PREFS_NAME = "monflo_bridge"
        private const val KEY_RECEIVER_URL = "receiver_url"
        private const val KEY_RETRY_QUEUE = "retry_queue"
        private const val MAX_RETRIES = 3
        private const val TIMEOUT_MS = 5000
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO)

    /**
     * Configure the receiver URL (e.g. "http://192.168.0.7:3456/capture")
     */
    fun setReceiverUrl(url: String) {
        prefs.edit().putString(KEY_RECEIVER_URL, url).apply()
    }

    /**
     * Get the current receiver URL
     */
    fun getReceiverUrl(): String? = prefs.getString(KEY_RECEIVER_URL, null)

    /**
     * POST alert to Mac receiver asynchronously
     * Falls back to local retry queue if offline
     */
    fun postAlert(sender: String?, text: String) {
        scope.launch {
            try {
                postToReceiver(sender, text)
            } catch (e: Exception) {
                // Queue locally for retry
                queueForRetry(sender, text)
            }

            // Process retry queue if receiver is back online
            processRetryQueue()
        }
    }

    private suspend fun postToReceiver(sender: String?, text: String) = withContext(Dispatchers.IO) {
        val receiverUrl = getReceiverUrl() ?: return@withContext

        val payload = JSONObject().apply {
            put("sender", sender ?: "Unknown")
            put("text", text)
        }

        val url = URL(receiverUrl)
        val connection = url.openConnection() as HttpURLConnection

        try {
            connection.apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                connectTimeout = TIMEOUT_MS
                readTimeout = TIMEOUT_MS
                doOutput = true
            }

            val body = payload.toString().toByteArray(Charsets.UTF_8)
            connection.outputStream.use { it.write(body) }

            val responseCode = connection.responseCode
            if (responseCode < 200 || responseCode >= 300) {
                throw Exception("HTTP $responseCode from receiver")
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun queueForRetry(sender: String?, text: String) {
        val queueJson = prefs.getString(KEY_RETRY_QUEUE, "[]")
        val queue = try {
            org.json.JSONArray(queueJson)
        } catch (e: Exception) {
            org.json.JSONArray()
        }

        // Limit queue to 100 entries to avoid unbounded growth
        while (queue.length() >= 100) {
            queue.remove(0)
        }

        queue.put(
            JSONObject().apply {
                put("sender", sender ?: "Unknown")
                put("text", text)
                put("timestamp", System.currentTimeMillis())
                put("retries", 0)
            }
        )

        prefs.edit().putString(KEY_RETRY_QUEUE, queue.toString()).apply()
    }

    private suspend fun processRetryQueue() = withContext(Dispatchers.IO) {
        val queueJson = prefs.getString(KEY_RETRY_QUEUE, "[]") ?: return@withContext
        val queue = try {
            org.json.JSONArray(queueJson)
        } catch (e: Exception) {
            return@withContext
        }

        if (queue.length() == 0) return@withContext

        val remainingQueue = org.json.JSONArray()

        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            val sender = item.getString("sender")
            val text = item.getString("text")
            val retries = item.getInt("retries")

            if (retries >= MAX_RETRIES) {
                continue // Drop after max retries
            }

            try {
                postToReceiver(sender, text)
            } catch (e: Exception) {
                item.put("retries", retries + 1)
                remainingQueue.put(item)
            }
        }

        prefs.edit().putString(KEY_RETRY_QUEUE, remainingQueue.toString()).apply()
    }
}
