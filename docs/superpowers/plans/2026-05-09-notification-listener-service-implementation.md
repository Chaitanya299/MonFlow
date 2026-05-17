# Notification Listener Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-reliability Android background service for real-time capture of UPI and banking transaction alerts with a native encrypted bridge to React Native.

**Architecture:** A native Android `NotificationListenerService` captures alerts from an allowlist of apps and writes them directly to a SQLCipher-encrypted Room database. React Native fetches and processes these alerts in batches when active, ensuring no data loss and maximum privacy.

**Tech Stack:** Kotlin, Android SDK, Room, SQLCipher, React Native (Native Modules).

---

### Task 1: Android Environment Initialization

**Files:**
- Create: `android/build.gradle`
- Create: `android/app/build.gradle`
- Modify: `package.json`

- [ ] **Step 1: Initialize the React Native Android project structure**

Run: `npx react-native-asset` (or similar command to scaffold `android/` if not present)

- [ ] **Step 2: Add SQLCipher and Room dependencies**

Modify `android/app/build.gradle`:
```gradle
dependencies {
    def room_version = "2.6.1"
    implementation "androidx.room:room-runtime:$room_version"
    implementation "androidx.room:room-ktx:$room_version"
    kapt "androidx.room:room-compiler:$room_version"
    implementation "net.zetetic:android-database-sqlcipher:4.5.4"
}
```

- [ ] **Step 3: Verify build configuration**

Run: `./gradlew help` in `android/`
Expected: SUCCESS

- [ ] **Step 4: Commit**

```bash
git add android/
git commit -m "chore: initialize android project structure and dependencies"
```

### Task 2: Native Persistence Layer (Vault)

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/RawAlert.kt`
- Create: `android/app/src/main/java/com/monflo/tracking/RawAlertDao.kt`
- Create: `android/app/src/main/java/com/monflo/tracking/NativeDatabase.kt`

- [ ] **Step 1: Define the RawAlert Entity**

```kotlin
package com.monflo.tracking

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "raw_alerts")
data class RawAlert(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val rawText: String,
    val packageName: String,
    val timestamp: Long
)
```

- [ ] **Step 2: Create the DAO**

```kotlin
package com.monflo.tracking

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface RawAlertDao {
    @Query("SELECT * FROM raw_alerts ORDER BY timestamp ASC")
    fun getAll(): List<RawAlert>

    @Insert
    fun insert(alert: RawAlert)

    @Query("DELETE FROM raw_alerts WHERE id IN (:ids)")
    fun deleteByIds(ids: List<Int>)
}
```

- [ ] **Step 3: Initialize SQLCipher Encrypted Database**

```kotlin
package com.monflo.tracking

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import android.content.Context
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

@Database(entities = [RawAlert::class], version = 1)
abstract class NativeDatabase : RoomDatabase() {
    abstract fun rawAlertDao(): RawAlertDao

    companion object {
        private var INSTANCE: NativeDatabase? = null

        fun getInstance(context: Context, passphrase: ByteArray): NativeDatabase {
            return INSTANCE ?: synchronized(this) {
                val factory = SupportOpenHelperFactory(passphrase)
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    NativeDatabase::class.java, "monflo-native-vault"
                ).openHelperFactory(factory).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java/com/monflo/tracking/
git commit -m "feat: implement native encrypted persistence layer"
```

### Task 3: Notification Listener Service

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/MonfloNotificationService.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Implement the Listener with Package Filtering**

```kotlin
package com.monflo.tracking

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class MonfloNotificationService : NotificationListenerService() {
    private val allowlist = setOf(
        "com.google.android.apps.nbu.paisa", // GPay
        "com.phonepe.app",
        "com.paytm.app"
    )

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!allowlist.contains(sbn.packageName)) return

        val text = sbn.notification.extras.getCharSequence("android.text")?.toString() ?: return
        if (text.length < 5) return

        // Save to DB (IO Thread)
        saveToVault(text, sbn.packageName)
    }

    private fun saveToVault(text: String, pkg: String) {
        // Implementation note: Fetch passphrase from Keystore and write to NativeDatabase
    }
}
```

- [ ] **Step 2: Register Service in Manifest**

```xml
<service android:name=".tracking.MonfloNotificationService"
         android:label="Monflo Tracking Service"
         android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement notification listener service with package filtering"
```

### Task 4: Native Bridge Module

**Files:**
- Create: `android/app/src/main/java/com/monflo/tracking/MonfloModule.kt`

- [ ] **Step 1: Implement Bridge Methods for Batch Fetch**

```kotlin
@ReactMethod
fun getPendingAlerts(promise: Promise) {
    // Return JSON array of RawAlerts
}

@ReactMethod
fun clearProcessedAlerts(ids: ReadableArray, promise: Promise) {
    // Delete by IDs
}
```

- [ ] **Step 2: Register Module in ReactPackage**

```kotlin
class MonfloPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(MonfloModule(reactContext))
    }
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement native bridge for batch alert fetching"
```

### Task 5: JS Integration & Universal Parser

**Files:**
- Create: `src/domain/tracking/AlertHandshake.ts`
- Modify: `src/presentation/App.tsx`
- Modify: `src/domain/tracking/UniversalParser.ts`

- [ ] **Step 1: Add Promotional Filtering to UniversalParser**

```typescript
const PROMO_KEYWORDS = ["offer", "reward", "cashback", "win", "discount"];

export const UniversalParser = {
  // ... existing parse logic
  isPromotional: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return PROMO_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }
};
```

- [ ] **Step 2: Build the TS Wrapper for the Handshake**

```typescript
export const runHandshake = async () => {
    const alerts = await MonfloBridge.getPendingAlerts();
    const processedIds = [];
    for (const alert of alerts) {
        if (!UniversalParser.isPromotional(alert.rawText)) {
            const tx = UniversalParser.parse(alert.rawText);
            if (tx) {
                await AccountingRepository.save(tx);
            }
        }
        processedIds.push(alert.id);
    }
    await MonfloBridge.clearProcessedAlerts(processedIds);
};
```

- [ ] **Step 3: Trigger Handshake on App Launch**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: integrate native bridge with universal parser and promo filtering"
```
