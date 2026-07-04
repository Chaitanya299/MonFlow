package com.monflo.tracking

import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MonfloModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String {
        return "MonfloBridge"
    }

    @ReactMethod
    fun getPendingAlerts(promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                val alerts = database.rawAlertDao().getAll()

                val result = Arguments.createArray()
                for (alert in alerts) {
                    val map = Arguments.createMap()
                    map.putInt("id", alert.id)
                    map.putString("rawText", alert.rawText)
                    map.putString("packageName", alert.packageName)
                    map.putDouble("timestamp", alert.timestamp.toDouble())
                    result.pushMap(map)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun clearProcessedAlerts(ids: ReadableArray, promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                val idList = mutableListOf<Int>()
                for (i in 0 until ids.size()) {
                    idList.add(ids.getInt(i))
                }
                database.rawAlertDao().deleteByIds(idList)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun initializeVault(promise: Promise) {
        try {
            val manager = VaultManager(reactApplicationContext)
            val mnemonic = manager.initializeNewVault()
            val result = Arguments.createArray()
            mnemonic.forEach { result.pushString(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("VAULT_INIT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isVaultInitialized(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("monflo_vault_prefs", Context.MODE_PRIVATE)
        promise.resolve(prefs.contains("enc_entropy"))
    }

    @ReactMethod
    fun setTrackingEnabled(enabled: Boolean, promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("isTrackingEnabled", enabled).apply()

        val intent = Intent(reactApplicationContext, MonfloNotificationService::class.java)
        if (enabled) {
            reactApplicationContext.startForegroundService(intent)
        } else {
            reactApplicationContext.stopService(intent)
        }
        promise.resolve(enabled)
    }

    @ReactMethod
    fun isTrackingEnabled(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
        promise.resolve(prefs.getBoolean("isTrackingEnabled", false))
    }

    @ReactMethod
    fun setBiometricEnabled(enabled: Boolean, promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("monflo_security_prefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("isBiometricEnabled", enabled).apply()
        promise.resolve(enabled)
    }

    @ReactMethod
    fun isBiometricEnabled(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences("monflo_security_prefs", Context.MODE_PRIVATE)
        promise.resolve(prefs.getBoolean("isBiometricEnabled", false))
    }

    @ReactMethod
    fun getIdentityPublicKey(promise: Promise) {
        try {
            promise.resolve(IdentityKeystoreHelper.getPublicKeyBase64())
        } catch (e: Exception) {
            promise.reject("KEYSTORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun signMessage(message: String, promise: Promise) {
        try {
            promise.resolve(IdentityKeystoreHelper.sign(message))
        } catch (e: Exception) {
            promise.reject("SIGNING_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setCaptureMode(mode: String, promise: Promise) {
        CaptureConfig.setMode(reactApplicationContext, mode)
        promise.resolve(CaptureConfig.getMode(reactApplicationContext))
    }

    @ReactMethod
    fun getCaptureMode(promise: Promise) {
        promise.resolve(CaptureConfig.getMode(reactApplicationContext))
    }

    @ReactMethod
    fun isNotificationListenerEnabled(promise: Promise) {
        val enabled = NotificationManagerCompat
            .getEnabledListenerPackages(reactApplicationContext)
            .contains(reactApplicationContext.packageName)
        promise.resolve(enabled)
    }

    // === Accounting Methods ===

    @ReactMethod
    fun saveTransaction(tx: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                val entity = ProcessedTransaction(
                    id = tx.getString("id")!!,
                    amountPaise = tx.getDouble("amountPaise").toLong(),
                    currency = tx.getString("currency")!!,
                    merchantName = if (tx.hasKey("merchantName")) tx.getString("merchantName") else null,
                    category = tx.getString("category")!!,
                    tags = tx.getArray("tags")!!.toArrayList().map { it.toString() },
                    sourcePackage = tx.getString("sourcePackage")!!,
                    rawText = tx.getString("rawText")!!,
                    timestamp = tx.getDouble("timestamp").toLong(),
                    isSplit = tx.getBoolean("isSplit"),
                    splitGroupId = if (tx.hasKey("splitGroupId")) tx.getString("splitGroupId") else null,
                    trustLevel = if (tx.hasKey("trustLevel")) tx.getString("trustLevel")!! else "UNKNOWN"
                )
                database.processedTransactionDao().insert(entity)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun getTransactionsByDateRange(startMs: Double, endMs: Double, promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                val txs = database.processedTransactionDao().getByDateRange(startMs.toLong(), endMs.toLong())
                promise.resolve(mapTransactionsToJS(txs))
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun updateTransactionCategory(txId: String, category: String, promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                database.processedTransactionDao().updateCategory(txId, category)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    // === Rule Methods ===

    @ReactMethod
    fun saveRules(rules: ReadableArray, promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                val ruleEntities = mutableListOf<ParserRule>()
                for (i in 0 until rules.size()) {
                    val map = rules.getMap(i)
                    ruleEntities.add(ParserRule(
                        id = map.getString("id")!!,
                        pattern = map.getString("pattern")!!,
                        flags = map.getString("flags")!!,
                        version = map.getInt("version")
                    ))
                }
                database.parserRuleDao().deleteAll()
                database.parserRuleDao().insertAll(ruleEntities)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun getRules(promise: Promise) {
        scope.launch {
            try {
                val database = NativeDatabase.getInstance(reactApplicationContext)
                val rules = database.parserRuleDao().getAll()
                val result = Arguments.createArray()
                for (rule in rules) {
                    val map = Arguments.createMap()
                    map.putString("id", rule.id)
                    map.putString("pattern", rule.pattern)
                    map.putString("flags", rule.flags)
                    map.putInt("version", rule.version)
                    result.pushMap(map)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("DB_ERROR", e.message)
            }
        }
    }

    // === Security Methods ===

    @ReactMethod
    fun authenticate(title: String, subtitle: String, promise: Promise) {
        val activity = currentActivity as? androidx.fragment.app.FragmentActivity
        if (activity == null) {
            promise.reject("AUTH_ERROR", "Activity is not a FragmentActivity")
            return
        }

        if (!BiometricHelper.canAuthenticate(activity)) {
            promise.resolve("NOT_SUPPORTED")
            return
        }

        UiThreadUtil.runOnUiThread {
            BiometricHelper.authenticate(activity, title, subtitle, object : BiometricHelper.AuthCallback {
                override fun onSuccess() {
                    promise.resolve("SUCCESS")
                }

                override fun onError(error: String) {
                    promise.reject("AUTH_ERROR", error)
                }

                override fun onCancel() {
                    promise.resolve("CANCELED")
                }
            })
        }
    }

    private fun mapTransactionsToJS(txs: List<ProcessedTransaction>): WritableArray {
        val result = Arguments.createArray()
        for (tx in txs) {
            val map = Arguments.createMap()
            map.putString("id", tx.id)
            map.putDouble("amountPaise", tx.amountPaise.toDouble())
            map.putString("currency", tx.currency)
            map.putString("merchantName", tx.merchantName)
            map.putString("category", tx.category)

            val tagsArray = Arguments.createArray()
            tx.tags.forEach { tagsArray.pushString(it) }
            map.putArray("tags", tagsArray)

            map.putString("sourcePackage", tx.sourcePackage)
            map.putString("rawText", tx.rawText)
            map.putDouble("timestamp", tx.timestamp.toDouble())
            map.putBoolean("isSplit", tx.isSplit)
            map.putString("splitGroupId", tx.splitGroupId)
            map.putString("trustLevel", tx.trustLevel)
            result.pushMap(map)
        }
        return result
    }
}
