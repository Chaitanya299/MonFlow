# Design Spec: Foreground Service Persistence for Monflo

**Status:** DRAFT  
**Date:** 2026-05-10  
**Author:** Antigravity (Claude)  

## 1. Overview
Ensure the "Magic" real-time tracking of UPI alerts is immortal to the Android OS by promoting the `MonfloNotificationService` to a **Foreground Service**. This design focuses on technical persistence while maintaining a subtle, non-intrusive user presence.

## 2. Technical Architecture

### 2.1 Foreground Promotion
- **Service Type:** `foregroundServiceType="specialUse"` (as per 2026 Android guidelines for tracking).
- **Sticky Start:** Implements `START_STICKY` in `onStartCommand` to ensure the OS restarts the service if it is killed under memory pressure.
- **Notification Channel:** 
    - ID: `monflo_tracking_channel`
    - Importance: `IMPORTANCE_LOW` (minimizes status bar noise).
    - Visibility: `VISIBILITY_SECRET` on lock screen (user choice fallback).

### 2.2 Native Components (Kotlin)

#### 2.2.1 `BootReceiver.kt`
- Listens for `android.intent.action.BOOT_COMPLETED`.
- Permission required: `android.permission.RECEIVE_BOOT_COMPLETED`.
- Logic: Reads `isTrackingEnabled` from `SharedPreferences` and restarts the service if true.

#### 2.2.2 `NotificationHelper.kt`
- Centralizes the logic for building the persistent notification.
- Text: "Monflo is Active".
- Icon: Monochrome shield icon.

### 2.3 Bridge Interface (`MonfloModule.kt`)
Exposes the following to React Native:
- `setTrackingEnabled(enabled: Boolean)`: Persists the flag and calls `startForegroundService()` or `stopForeground(true)`.
- `isTrackingEnabled()`: Returns the current persisted state.

## 3. Data Flow & Interaction

### 3.1 Initial Setup
1. User grants "Notification Access" permission.
2. User toggles "Auto-Tracking" in Settings.
3. JS calls `setTrackingEnabled(true)`.
4. Kotlin service promotes itself to foreground and displays the subtle icon.

### 3.2 System Reboot
1. Device restarts.
2. `BootReceiver` triggers.
3. Service resumes tracking silently in the background.

## 4. Security & Privacy
- **Awareness:** The persistent icon ensures the user is always aware that local tracking is active (anti-spyware transparency).
- **Data Isolation:** The foreground logic remains decoupled from the parsing logic; it only ensures the process stays alive.

## 5. Success Criteria
- The `MonfloNotificationService` survives aggressive background task killing.
- The service restarts automatically after a device reboot.
- The "Start/Stop" toggle in the React Native UI correctly controls the native service state.
