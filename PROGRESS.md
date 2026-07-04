# Monflo Project Progress Dashboard

> **Version:** 1.0.0.0 (V1 Prototype) | **Last Updated:** 2026-06-28
> **Status:** `V1_PROTOTYPE_COMPLETE` | **System Health:** 🟢 Optimal

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
| **E2EE Cloud Backup** | 📝 ALREADY PLANNED | Awaiting V2 implementation | P1 |
| **Auto-Categorization** | ✅ TESTED | 15 unit tests (categorizer + handshake e2e) | P1 |
| **Merchant Detector** | 🟡 BASIC | Merchant surfaced from parser events; keyword categorizer live | P2 |
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
- [x] **Capture Reliability Engine:** Self-healing capture — `onListenerDisconnected → requestRebind`, `onListenerConnected` backfill of on-screen alerts, `onTaskRemoved` re-assert, expanded boot receiver (boot/locked-boot/quickboot/package-replaced), a 15-min WorkManager watchdog, and SharedPreferences heartbeat + gap detection surfaced as an in-app banner and a heads-up system notification.
- [x] **Auto-Categorization Engine:** On-device keyword categorizer (`TransactionCategorizer.ts`) maps each parsed transaction into the existing 7-category taxonomy (groceries→food, travel→transport). Wired into the handshake — merchant name surfaced from parser events, category assigned on capture; unknown merchants stay `untagged` for the Untagged Bucket. Rendered by `TransactionItem` and aggregated in the daily summary.

### 🟡 Improvement Needed / Tech Debt
- [ ] **OEM autostart/battery UX (Phase 4):** Per-manufacturer autostart deep-links + battery-optimization opt-out flow. Designed, deferred — needs physical-device validation (see Manual OEM Validation Matrix below).

### 🔵 Research Needed
- [ ] **Network Latency:** Waku Gossip performance on high-latency 4G/5G mobile networks.
- [ ] **Device Fragmentation:** Biometric prompt consistency across Samsung/Xiaomi/Pixel OEMs.
- [ ] **TPM Availability:** KeyStore fallback reliability on non-hardware-backed (TEE) devices.
- [ ] **iOS Automation Scope:** Investigating Background Tasks and Notification Service Extension limits on iOS vs Android's "Black Box" strategy.

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
| 2026-06-28 | **Accounting** | Auto-categorize transactions via on-device keyword rules into the existing 7-category taxonomy (reuse, no data-model change; groceries→food, travel→transport). Unmatched stays `untagged` rather than guessing. | High (UX) |
| 2026-06-28 | **Reliability** | Engine-first capture reliability: rebind + onTaskRemoved + boot expansion + WorkManager 15-min watchdog + heartbeat/gap detection. Gap alerting via in-app banner **and** system notification. OEM autostart/battery UX deferred to Phase 4. | Critical (Data Integrity) |
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
