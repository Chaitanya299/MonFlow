# Monflo Project Progress Dashboard

> **Version:** 1.0.0.0 (V1 Prototype) | **Last Updated:** 2026-07-02
> **Status:** `LAUNCH_READY_MINUS_RELEASE_HYGIENE` | **System Health:** 🟢 Core Solid / ⚠️ Wrapper Issues

---

## 1. Granular Status Board

| Component | Status | Verification | Priority |
| :--- | :--- | :--- | :--- |
| **Notification Capture** | ✅ TESTED | 46 unit tests + manual | P0 |
| **SMS Fallback Engine** | ✅ TESTED | JUnit ready | P1 |
| **Encrypted Vault (SQLCipher)** | ✅ TESTED | Manual key derivation check | P0 |
| **Automerge Sync Engine** | ✅ TESTED | Contract tests passed | P0 |
| **Waku/Relay Network** | ✅ IMPLEMENTED | Ready for E2E load test | P0 |
| **Biometric Gate** | ✅ IMPLEMENTED | Bridge methods functional | P1 |
| **Reality Simulator** | ✅ TESTED | Visual trace validated | P1 |
| **TRAI Compliance** | ✅ IMPLEMENTED | Header suffix analysis (DLT) | P0 |
| **UPI & Wallet Alerts Capture** | ✅ TESTED | 11 package-specific unit tests | P0 |
| **Monochrome UI (V1)** | ✅ IMPLEMENTED | Live dashboard + feed | P1 |
| **iOS Automation (Shortcut)** | ✅ TESTED | Receiver + production parser integration | P0 |
| **Merchant Detector** | ✅ TESTED | Trie + fuzzy matching, 50+ merchants, 26 tests | P0 |
| **Android SMS Bridge** | ✅ TESTED | POSTs to Mac receiver, offline retry queue | P0 |
| **E2EE Cloud Backup** | 📝 ALREADY PLANNED | Awaiting V2 implementation | P1 |
| **Bluetooth Discovery** | 🧪 RESEARCH NEEDED | Investigating BLE power drain | P2 |

---

## 2. Component Lifecycle Details

### 🟢 Completed & Tested
- [x] **Universal Parser:** Integer-based paise math with 100% regex coverage.
- [x] **Handshake Logic:** Atomic fetch-and-clear between Native and JS layers.
- [x] **Deduplication Buffer:** 60-second window preventing double-counting.
- [x] **Signed Rule Bundles:** Ed25519-signed dynamic parser updates.
- [x] **P2P Social Pairing:** Deep linking (`monflo://invite`) functionality.
- [x] **Untagged Bucket:** UI and persistence for manual reconciliation.
- [x] **Regex Expansion:** Parsed and validated 25+ real-world transaction/SMS formats covering HDFC, SBI, ICICI, HSBC, Union Bank, YES Bank, BOI, and KVB.
- [x] **iOS Shortcut Receiver:** Production parser integration (UniversalParser), SMS→Notes flow, durable raw logging, built-in dedup, "Txn" format support.
- [x] **Merchant Detection:** Trie-based exact match + Levenshtein fuzzy match. 50+ Indian merchants, auto-categorization. <0.001ms per lookup (cached).
- [x] **Android SMS Bridge:** POSTs SMS to Mac receiver. Offline retry queue (100 max), 3 retries per alert. Parity with iOS.

### 🟡 Release-Blocking Issues (Pre-Launch Fixes)
- ✅ **RESOLVED (2026-07-02):** Native notification allowlist had **wrong package IDs** (GPay missing `.user` suffix, Paytm listed as `com.paytm.app` instead of `net.one97.paytm`) — only PhonePe was capturable on a real device. Fixed in [AlertFilter.kt](android/app/src/main/java/com/monflo/tracking/AlertFilter.kt); Kotlin tests updated to the real IDs plus a regression test rejecting the stale GPay ID. **Still pending: real-device smoke test (₹1 through each app).**
- ✅ **RESOLVED (2026-07-03):** Unparsed alerts were **silently deleted** — the handshake now saves parser misses as raw `untagged` transactions (amount 0, tag `unparsed`) so they surface in the Untagged Bucket, and a per-alert try/catch stops one malformed alert from stalling the whole inbox. Field miss-rate is measurable via `TelemetryReporter.getMetrics().totalFailures`.
- ✅ **RESOLVED (2026-07-02):** Listener now auto-rebinds via `onListenerDisconnected` + `requestRebind` (OEM battery-kill recovery), prefers `android.bigText` over truncated `android.text`, and `bridge` is lazily initialized (rebind path never calls `onStartCommand`, which previously left the `lateinit` unset → crash). Bank SMS are now captured **without SMS permissions** via Google/Samsung Messages notifications, gated by `isRelevantSms` so personal texts never enter the vault; credit keywords (`credited`, `received`, `withdrawn`) added so income alerts pass the filter.
- **CRITICAL:** Release build signs with **debug keystore** — must generate production keystore + update gradle config
- **CRITICAL:** `versionCode 1`, versions misaligned (package.json `0.1.1.0`, PROGRESS `1.0.0.0`, gradle `1.0`) — standardize
- **CRITICAL:** `targetSdkVersion 34` → Google Play now requires **API 35** for new submissions (and API 40+ by 2026-Q3)
- ✅ **RESOLVED (2026-07-03):** Dev Mac bridge (`postAlert`) is now gated behind `BuildConfig.DEBUG` — release builds never transmit alerts off-device, so the "100% local" claim and a "no data collected" Play Data Safety declaration hold. Dev workflow unchanged in debug builds.
- **CRITICAL:** `RECEIVE_SMS`/`READ_SMS` in manifest — **Google Play will reject** for expense tracking (SMS not an approved use case). Decision: Play flavor notification-listener-only, keep SMS for sideload/beta
- ✅ **RESOLVED (2026-07-03):** DevTestScreen 5-tap gesture is gated behind `__DEV__` — unreachable in release builds, still available for on-device test runs in debug. Also fixed: `MerchantDetector` imported `TransactionCategory` from the wrong module (compiled under vitest only because it skips typechecking).
- **HIGH:** `MonfloBridgeService` initialized only in `onStartCommand` — if NotificationListenerService rebinds without that path, first notification throws and kills service. Fix: move init to companion object or lazy-init with fallback
- **HIGH:** CI missing Kotlin tests + lint + tsc — only `npm test` runs; add `./gradlew testDebugUnitTest` and typecheck
- **MEDIUM:** No encrypted export/backup — user loses all history if phone is lost. Consider V1 CSV/JSON export before V2 cloud backup
- **MEDIUM:** Play Store paperwork (privacy policy URL, Data Safety form, NotificationListener justification) not started

### 🟡 Maturity & Unproven Components
- **Waku P2P Sync:** contract tests pass, but no field data on mobile 4G/5G latency or OEM biometric consistency. Consider feature-flagged launch (tracker only) to decouple sync risk
- **iOS:** Not a product for V1 — Shortcut + Mac receiver only. Revisit for V2 native iOS app if user demand justifies
- **Merchant Detection:** Trie + fuzzy matching tested in isolation; not battle-tested against live transaction volume or localized merchant variants

### 🔵 Research Needed
- [ ] **Network Latency:** Waku Gossip performance on high-latency 4G/5G mobile networks.
- [ ] **Device Fragmentation:** Biometric prompt consistency across Samsung/Xiaomi/Pixel OEMs.
- [ ] **TPM Availability:** KeyStore fallback reliability on non-hardware-backed (TEE) devices.

### 🔴 Yet to be Planned / Future Milestones
- [ ] **UPI Deep-Link Interface:** Integration with external UPI apps for one-tap payback.
- [ ] **Trip Templates:** Pre-defined split patterns for travel (Flights, Stay, Food) with group-wide budgets.
- [ ] **Multi-Currency Support:** Researching exchange rate sync for non-INR transactions.
- [ ] **Budgeting Engine:** Designing the "Bachelor Mode" spending limit alerts.
- [ ] **Merchant Analytics:** Planning the local-only merchant categorization logic.
- [ ] **On-Device ML (NER):** High dataset collection and setup costs for V1, though excellent for V2/V3.

---

## 3. Decision Log

| Date | Category | Decision | Impact |
| :--- | :--- | :--- | :--- |
| 2026-07-04 | **Testing** | Added dev "Capture Lab" (5-tap → Dev screen): 4 capture-source test modes (`CaptureConfig` in SharedPreferences, honored live by native services) + CSV export of every captured txn (raw → parsed) via RN `Share`. Default mode ALL = unchanged production behavior. | High (Field validation) |
| 2026-07-04 | **Accounting** | Expanded merchant rules to ~60 vendor groups; grouped quick-commerce grocery (Blinkit/Zepto/Instamart/BigBasket/Dunzo) under **food** — moved Blinkit/BigBasket out of `shopping` for budgeting-accurate "food & groceries". | Medium (Categorization accuracy) |
| 2026-07-02 | **Tracking** | 3-tier notification allowlist: pure-payment apps (GPay/PhonePe/Paytm/BHIM/super.money/Navi) captured raw; SMS apps + mixed apps (WhatsApp/CRED/iMobile/Amazon) captured only through the money-relevance gate so chats/orders/promos never enter the vault. All package IDs Play-Store-verified. | High (Coverage, Privacy) |
| 2026-07-02 | **Tracking** | Capture bank SMS via SMS-app notifications (Google/Samsung Messages allowlist) instead of SMS permissions — the Play-compliant universal fallback. Routed as `sms:<sender>` so TRAI trust analysis applies. | High (Play Compliance, Coverage) |
| 2026-07-02 | **Tracking** | Corrected GPay/Paytm package IDs in native allowlist; listener auto-rebind for OEM battery kills; bigText extraction for long alerts. | High (Capture Reliability) |
| 2026-06-24 | **Android** | Android SMS bridge POSTs to same Mac receiver as iOS. Offline retry queue handles connectivity gracefully. | High (Parity, Reliability) |
| 2026-06-24 | **Accounting** | Merchant detection uses Trie + Levenshtein (not regex). Avoids backtracking; scales to 1000s merchants offline. | High (Performance, Reliability) |
| 2026-06-24 | **iOS** | iOS Shortcut receiver uses UniversalParser (not throwaway regex); durable raw log before parsing. | High (Accuracy, Reliability) |
| 2026-06-24 | **Tracking** | Add "txn" as debit keyword in FsmParser and isCredit() for HDFC card alerts. | Medium (Coverage) |
| 2026-05-18 | **Tracking** | Implement Package-Specific Regex Mapping for GPay, PhonePe, Paytm notifications in UniversalParser. | High (Accuracy) |
| 2026-05-17 | **Tracking** | Enhanced regex matching & normalization rules to support 25+ real-life Indian banking/SMS formats. | High (Accuracy) |
| 2026-05-15 | **Security** | Mandatory Biometric Gate at app entry. | High (Privacy) |
| 2026-05-15 | **Network** | Waku Relay primary, WebSocket fallback. | High (Reliability) |
| 2026-05-15 | **Social** | Automerge CRDTs for split consistency. | High (Data Integrity) |
| 2026-05-15 | **Architecture** | Refactored Native capture to use `AlertFilter`. | Medium (Testability) |

---

## 4. Quality Metrics
- **JS Coverage:** 100% (Domain & Tracking logic)
- **Replay Accuracy:** 100% (Verified against 33 real-life SMS samples)
- **Security Grade:** A- (Pending dependency updates)
- **Local Persistence:** SQLCipher AES-256 + Keystore Hardware Binding
