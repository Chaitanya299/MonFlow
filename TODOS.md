# TODOS: Monflo

## Tracking
- [x] Build `SmsReceiver` for fallback bank-direct debit capture **Priority: P1**
- [x] Implement 60s Deduplication Window in `DeduplicationBuffer` **Priority: P1**
- [x] Integrate "Signed Rule Bundles" for secure remote rule updates **Priority: P1**

## Accounting
- [x] Implement `AccountingRepository` with Room DB support **Priority: P1**

## Social
- [x] Implement CRDT-based P2P sync for zero-server consistency **Priority: P0**
- [x] Build "Handshake Invites" via secret key links (WhatsApp/Signal) **Priority: P1**
- [ ] Implement Bluetooth discovery for nearby friend pairing **Priority: P2**

## Security & Privacy
- [x] Implement Biometric Vault Gate (Fingerprint/Face lock) **Priority: P1**
- [ ] Setup E2EE Google Drive backup with 12-word recovery key **Priority: P1**
- [ ] Establish "Signing Key Governance" protocol **Priority: P1**

## UI/UX
- [ ] Design "Instructional Empty States" for Spending and Split tabs **Priority: P1**
- [x] Implement "Actionable Monochrome" UI with financial color cues **Priority: P1**
- [x] Build "Untagged Bucket" UI for manual transaction reconciliation **Priority: P1**

## Completed
- [x] Bootstrap React Native / TypeScript project structure **Completed: v0.1.1.0 (2026-05-09)**
- [x] Setup Vitest testing framework with 100% coverage **Completed: v0.1.1.0 (2026-05-09)**
- [x] Fix critical parser corruption and precision gaps **Completed: v0.1.1.0 (2026-05-09)**
- [x] Setup GitHub Actions CI/CD workflow **Completed: v0.1.1.0 (2026-05-09)**
- [x] Initialize SQLCipher with AES-256 for encrypted local storage **Completed: v0.1.1.0 (2026-05-10)**
- [x] Integrate Android Keystore for hardware-backed encryption keys **Completed: v0.1.1.0 (2026-05-10)**
- [x] Implement `NotificationListenerService` for real-time GPay/PhonePe scraping **Completed: v0.1.1.0 (2026-05-10)**
- [x] Implement End-to-End P2P Sync Engine (Automerge + Waku) **Completed: v1.0.0.0 (2026-05-15)**
- [x] Implement Handshake Invites & Social Pairing **Completed: v1.0.0.0 (2026-05-15)**
- [x] Implement Biometric Vault Gate **Completed: v1.0.0.0 (2026-05-15)**
- [x] Implement Actionable Monochrome Dashboard & Feed **Completed: v1.0.0.0 (2026-05-15)**
- [x] Implement Untagged Bucket & Reconciliation Flow **Completed: v1.0.0.0 (2026-05-15)**
