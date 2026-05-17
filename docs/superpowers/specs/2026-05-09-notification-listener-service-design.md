# Design Spec: Monflo Notification Listener Service

**Status:** DRAFT  
**Date:** 2026-05-09  
**Author:** Antigravity (Claude)  

## 1. Overview
A high-reliability Android background service for real-time capture of UPI (GPay, PhonePe, Paytm) and banking transaction alerts. The service follows a **Local-First / Native Black Box** architecture to ensure 100% data integrity while maintaining user privacy.

## 2. Architecture & Components

### 2.1 MonfloNotificationService (Kotlin)
- **Role:** Extends Android's `NotificationListenerService`.
- **Filtering:** 
    - Package Name Allowlist: `com.google.android.apps.nbu.paisa` (GPay), `com.phonepe.app`, `com.paytm.app`.
    - Content Validation: Minimum text length check (5+ characters) to avoid noise.
- **Persistence:** Promoted to a **Foreground Service** with a subtle status bar icon to prevent OS termination.

### 2.2 Native Vault (Room DB)
- **Security:** Encrypted with **SQLCipher (AES-256)** using a key derived from the **Android Keystore**.
- **Schema:** `RawAlert` table storing:
    - `id` (Auto-increment)
    - `rawText` (String)
    - `packageName` (String)
    - `timestamp` (Long)

### 2.3 MonfloBridge (Native Module)
- **Role:** Facilitates batch data transfer to React Native.
- **Integrity:** Implements local **Ed25519** signature verification for remote rule updates.
- **Methods:**
    - `getPendingAlerts()`: Returns a JSON array of all unparsed alerts.
    - `deleteAlerts(ids: Int[])`: Clears the "Inbox" after successful JS parsing.

## 3. Data Flow (Batch Processing)
1. **Capture:** Notification arrives -> `NotificationListenerService` captures and saves to `Native Vault`.
2. **Activation:** User opens app -> JS layer calls `getPendingAlerts()`.
3. **Parse & Filter:**
    - `UniversalParser.ts` runs against each alert.
    - **Promotional Filter:** Discards alerts matching negative patterns (e.g., "offer", "reward", "congratulations").
4. **Finalize:** Valid transactions are moved to the Processed Vault; JS instructs Native to clear the processed IDs.

## 4. Error Handling & Resilience
- **Database Locked:** Implements a retry loop for native writes.
- **Permission Revoked:** Detects `onListenerDisconnected()` and surfaces a "Tracking Paused" UI banner with deep-links to system settings.
- **Malformed Rules:** JS parser implements `try-catch` with local cache fallback for the **Signed Rule Bundles**.

## 5. Testing Strategy
- **Native Unit Tests:** Verify Regex-free filtering (package name check) and text extraction from different Android versions.
- **Bridge Stress Tests:** Verify the transfer of 100+ raw alerts in a single batch.
- **E2E Simulation:** Use a custom test utility to post "fake" notifications and verify they appear in the TypeScript ledger.

## 6. NOT in scope (v1)
- Real-time JS events (favoring batch processing for battery/RAM efficiency).
- Non-Indian banking apps (focusing on UPI and primary Indian private/PSU banks).
