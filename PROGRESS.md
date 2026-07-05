# Monflo Project Progress Dashboard

> **Version:** 1.0.0.0 (V1 Prototype) | **Last Updated:** 2026-07-04
> **Status:** `LAUNCH_READY_MINUS_RELEASE_HYGIENE` | **System Health:** 🟢 Core Solid / ⚠️ Wrapper Issues

---

## 1. Granular Status Board

| Component | Status | Verification | Priority |
| :--- | :--- | :--- | :--- |
| **Notification Capture** | ✅ TESTED | 46 unit tests + manual | P0 |
| **Capture Reliability (Rebind + Watchdog)** | ✅ UNIT-TESTED | 7 unit tests; ⏳ pending on-device OEM matrix | P0 |
| **SMS Fallback Engine** | ✅ TESTED | JUnit ready | P1 |
| **Encrypted Vault (SQLCipher)** | ✅ TESTED | Manual key derivation check | P0 |
| **Automerge Sync Engine** | ✅ TESTED | Contract tests passed | P0 |
| **Waku/Relay Network** | ✅ IMPLEMENTED | Ready for E2E load test | P0 |
| **Biometric Gate** | ✅ IMPLEMENTED | Bridge methods functional | P1 |
| **Reality Simulator** | ✅ TESTED | Visual trace validated | P1 |
| **TRAI Compliance** | ✅ IMPLEMENTED | Header suffix analysis (DLT) | P0 |
| **UPI & Wallet Alerts Capture** | ✅ TESTED | 11 package-specific unit tests | P0 |
| **Monochrome UI (V1)** | ✅ IMPLEMENTED | Live dashboard + feed | P1 |
| **Manual Transaction Entry** | ✅ TESTED | 5 unit tests (paise validation, sign, wallet math) | P1 |
| **Hand Cash Wallet** | ✅ IMPLEMENTED | Running balance + today's cash spend on Dashboard | P1 |
| **Edit / Delete Transaction** | ✅ IMPLEMENTED | Long-press → edit (manual/cash) or delete (any); `deleteTransaction` bridge | P1 |
| **iOS Automation (Shortcut)** | ✅ TESTED | Receiver + production parser integration | P0 |
| **Merchant Detector** | ✅ TESTED | Trie + fuzzy matching, 50+ merchants, 26 tests | P0 |
| **Android SMS Bridge** | ✅ TESTED | POSTs to Mac receiver, offline retry queue | P0 |
| **On-Device Test Runner** | ✅ IMPLEMENTED | 66 Hermes tests via 5-tap gesture | P1 |
| **Live Monitor** | ✅ IMPLEMENTED | Polls DB 2s, raw vs parsed side-by-side | P1 |
| **Notification Simulator** | 🟡 DEVICE VERIFY | 10 presets; real heads-up notif + DB inject | P1 |
| **Capture Reliability (Watchdog)** | 🟡 DEVICE VERIFY | Listener rebind + WorkManager watchdog + battery exemption | P0 |
| **E2EE Cloud Backup** | 📝 ALREADY PLANNED | Awaiting V2 implementation | P1 |
| **Auto-Categorization** | ✅ TESTED | 15 unit tests (categorizer + handshake e2e) | P1 |
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
- [x] **On-Device Test Runner:** Hermes-native minitest shim runs 66 domain tests on-device (5-tap gesture on "Your Vault" → DevTestScreen). Confirms parser behaves identically under Hermes vs Node/Vitest.
- [x] **Live Monitor:** Dev screen polls `getPendingAlerts()` every 2s, shows raw SMS/notification text beside `UniversalParser` output in real time. Read-only — never clears alerts.
- [x] **GPay Package Fix:** Corrected notification allowlist + simulator preset to `com.google.android.apps.nbu.paisa.user` (matches `GPAY_PACKAGE`); GPay alerts now pass the allowlist and route to the gpay_paid template.
- [x] **Capture Reliability Engine:** Closes the biggest silent-failure risk in the app — OEM battery killers (Xiaomi/Samsung/Oppo/Vivo) routinely kill `NotificationListenerService` processes with no OS-level restart, silently ending capture with no visible sign. Layers: (1) `onListenerConnected`/`onListenerDisconnected` override with `requestRebind()`, plus a backfill of any alerts still on-screen via `activeNotifications` on reconnect; (2) `CaptureHealth` (SharedPreferences-backed) distinguishes a background-suppression gap from an access-revoked gap, keeping a capped history of both; (3) `CaptureWatchdog`/`CaptureWatchdogWorker` (WorkManager, 15-min periodic + immediate kick from `onDestroy`/`onTaskRemoved`) re-arms the foreground service; (4) `requestIgnoreBatteryOptimizations` bridge method + "Unrestricted Battery" row in `PermissionsSetupScreen` — the actual root-cause fix, since Doze/App Standby exemption stops most OEM kills before they happen. `Dashboard` surfaces a gap-reason banner (reusing the existing fetch/refresh cadence) that routes to permissions setup or acknowledges the gap.
- [x] **Auto-Categorization Engine:** On-device keyword categorizer (`TransactionCategorizer.ts`) maps each parsed transaction into the existing 7-category taxonomy (groceries→food, travel→transport) from merchant name **and** raw alert text. Wired into the handshake; unmatched merchants stay `untagged` for the Untagged Bucket rather than guessing.
- [x] **Manual Transaction Entry:** General "+" FAB adds an expense/income manually. Pure `ManualEntry.ts` money logic (paise validation at the boundary, signed amounts), reuses the existing `saveTransaction` bridge — no native schema change. 5 unit tests.
- [x] **Hand Cash Wallet:** Dashboard card showing cash-on-hand (top-ups minus spends) + today's cash spend. "Add cash" logs a top-up or cash spend (`sourcePackage: 'cash'`).
- [x] **Edit / Delete:** Long-press a transaction → Edit (manual/cash entries, replaces the row via `saveTransaction` + `onConflict=REPLACE`) or Delete (any entry, via new `deleteTransaction` bridge → existing DAO `delete`).

### 🟡 Improvement Needed / Tech Debt
- [ ] **Notification Simulator — device verify:** Built (10 presets: 5 UPI apps + 5 bank SMS). Tap row → inline parse (dedup cleared so re-parse works); 🔔 → real heads-up notification (HIGH-importance channel + POST_NOTIFICATIONS) + DB inject for accurate per-app parse in Live Monitor. Requires APK rebuild; pending on-device confirmation.
- [ ] **Capture Reliability — device verify:** Pure gap-computation logic is unit-tested (`CaptureHealthTest.kt`), but the WorkManager/background-execution path is untested on real OEM hardware (the actual failure mode it targets). Needs multi-hour/overnight soak tests on at least one Xiaomi/Oppo/Vivo device with the app backgrounded, plus manual "swipe from recents" and "force-stop then wait" checks.
- [ ] **SuperMoney + Navi parser templates:** No package-specific templates yet (only GPay/PhonePe/Paytm). Both fall to FSM fallback — fire those presets in the simulator and add templates based on actual output.
- [ ] **OEM autostart/battery UX (Phase 4):** Per-manufacturer autostart deep-links + battery-optimization opt-out flow. Designed, deferred — needs physical-device validation (see Manual OEM Validation Matrix below).

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
| 2026-06-28 | **Accounting** | Auto-categorize transactions via on-device keyword rules into the existing 7-category taxonomy (reuse, no data-model change; groceries→food, travel→transport). Unmatched stays `untagged` rather than guessing. | High (UX) |
| 2026-06-28 | **Reliability** | Engine-first capture reliability: rebind + onTaskRemoved/onDestroy kick + boot expansion + WorkManager 15-min watchdog + gap detection (`CaptureHealth`, replaces an earlier simpler heartbeat prototype). Gap alerting via in-app banner. OEM autostart/battery UX deferred to Phase 4. | Critical (Data Integrity) |
| 2026-06-28 | **Android** | WorkManager (not raw AlarmManager) drives the capture watchdog — periodic minimum is 15 min either way, but WorkManager survives Doze/App Standby transitions and process death more reliably, and needs no manual manifest wiring beyond the dependency. | High (Reliability) |
| 2026-06-27 | **Tracking** | Notification Simulator: 🔔 posts a real heads-up notification AND injects to DB with the correct package. Android won't let an app post "as" PhonePe (pkg is always com.monflo), so per-app routing is tested via the inject path, not the live notification. | Medium (Testability) |
| 2026-06-27 | **Tracking** | Clear `Deduplicator` before each inline simulator parse. Parser dedupes any sourcePackage≠'app' within a 5-min window, so re-parsing the same preset returned null (false "PARSE FAILED"). | Medium (DevEx) |
| 2026-06-27 | **Android** | Fix GPay package to `com.google.android.apps.nbu.paisa.user` in AlertFilter allowlist + simulator preset (was missing `.user`, so GPay alerts were dropped at the allowlist and never reached the gpay template). | High (Accuracy) |
| 2026-07-04 | **Accounting** | Manual entries + cash wallet reuse `ProcessedTransaction` + `saveTransaction` (discriminated by `sourcePackage: 'cash' \| 'manual'`). No native schema change. | High (Simplicity) |
| 2026-07-04 | **Accounting** | Edit = re-save with same id (`onConflict=REPLACE`); no separate update bridge. Delete = new `deleteTransaction` bridge → existing DAO `delete`. | Medium (Correctness) |
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

## 4. Manual OEM Validation Matrix (Capture Reliability)

Unit tests cover the pure gap/heartbeat logic; "did the OEM kill us overnight" can only be
verified on physical hardware. Run each device for hours/overnight with tracking on.

| Check | How to verify | Xiaomi/Redmi/POCO | Samsung | Oppo/Realme | Vivo | OnePlus | Pixel |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| FGS + watchdog scheduled on enable | `adb shell dumpsys jobscheduler \| grep monflo` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Listener rebinds after disconnect | toggle notification access off→on, confirm `onListenerConnected` heartbeat | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Survives app swipe from recents | swipe app, send test UPI alert, confirm captured | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Survives `am force-stop` | `adb shell am force-stop com.monflo`, wait a tick, send alert | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Recovers after overnight battery kill | leave overnight, confirm capture resumes + gap recorded if down | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Access-revoked → banner + system notification | revoke notification access, wait a tick | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Re-arms after reboot | reboot device, confirm FGS + watchdog return | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

> Phase 4 (per-OEM autostart + battery-whitelist onboarding) targets the rows that fail here.

---

## 5. Quality Metrics
- **JS Coverage:** 100% (Domain & Tracking logic)
- **Replay Accuracy:** 100% (Verified against 33 real-life SMS samples)
- **Security Grade:** A- (Pending dependency updates)
- **Local Persistence:** SQLCipher AES-256 + Keystore Hardware Binding
