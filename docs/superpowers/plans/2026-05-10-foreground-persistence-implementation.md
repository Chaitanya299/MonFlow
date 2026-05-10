# Foreground Service Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the `MonfloNotificationService` to a foreground service to ensure real-time tracking persists across app restarts and device reboots.

**Architecture:** The Kotlin service uses `startForeground` with a low-importance notification channel to maintain persistence. A native `BootReceiver` handles the `RECEIVE_BOOT_COMPLETED` signal to resume tracking automatically. React Native controls the lifecycle via new bridge methods.

**Tech Stack:** Kotlin, Android SDK, React Native (Native Modules).

---

### Task 1: Permissions and Service Configuration

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add foreground service and boot permissions**

Add to `<manifest>`:
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

- [ ] **Step 2: Update service definition with type**

Modify `<service>`:
```xml
<service android:name=".tracking.MonfloNotificationService"
         android:label="Monflo Tracking Service"
         android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
         android:foregroundServiceType="specialUse"
         android:exported="true">
    <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
              android:value="Transaction and expense tracking for financial privacy." />
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "chore: add foreground service permissions and configuration"
```

### Task 2: Notification Channel & Builder

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/NotificationHelper.kt`

- [ ] **Step 1: Implement subtle notification logic**

```kotlin
package com.monflo.tracking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

object NotificationHelper {
    private const val CHANNEL_ID = "monflo_tracking_channel"
    private const val CHANNEL_NAME = "Monflo Tracking"

    fun createNotificationChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW
        )
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    fun buildNotification(context: Context): Notification {
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Monflo is Active")
            .setContentText("Protecting your financial privacy locally.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock) // Placeholder icon
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(Notification.CATEGORY_SERVICE)
            .build()
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/monflo/tracking/NotificationHelper.kt
git commit -m "feat: implement NotificationHelper for subtle foreground persistence"
```

### Task 3: Foreground Service Promotion

**Files:**
- Modify: `android/app/src/main/java/com/monflo/tracking/MonfloNotificationService.kt`

- [ ] **Step 1: Implement startForeground logic**

Update `MonfloNotificationService.kt`:
```kotlin
override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    NotificationHelper.createNotificationChannel(this)
    startForeground(1, NotificationHelper.buildNotification(this))
    return START_STICKY
}
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/java/com/monflo/tracking/MonfloNotificationService.kt
git commit -m "feat: promote tracking service to foreground"
```

### Task 4: Auto-Start on Boot

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/BootReceiver.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Implement the BootReceiver**

```kotlin
package com.monflo.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("monflo_tracking_prefs", Context.MODE_PRIVATE)
            if (prefs.getBoolean("isTrackingEnabled", false)) {
                val serviceIntent = Intent(context, MonfloNotificationService::class.java)
                context.startForegroundService(serviceIntent)
            }
        }
    }
}
```

- [ ] **Step 2: Register receiver in manifest**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement auto-start on boot for tracking service"
```

### Task 5: Native Bridge Controls

**Files:**
- Modify: `android/app/src/main/java/com/monflo/tracking/MonfloModule.kt`

- [ ] **Step 1: Add setTrackingEnabled and status methods**

```kotlin
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
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: expose tracking controls to React Native bridge"
```
