package com.monflo.tracking

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
}
