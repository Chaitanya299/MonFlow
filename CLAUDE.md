# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### React Native / JS
- **Run (Metro):** `npm start`
- **Run (Android):** `npm run android`
- **Run Tests:** `npm test`
- **Watch Tests:** `npm run test:watch`
- **Lint:** `npm run lint`

### Android (Native)
- **Gradle Build:** `cd android && ./gradlew build`
- **Clean Build:** `cd android && ./gradlew clean`
- **Run Single Test (Kotlin):** `cd android && ./gradlew testDebugUnitTest --tests "com.monflo.tracking.*"`

## Progress Tracking
- **Dashboard:** `PROGRESS.md` is the source of truth for project status.
- **Rule:** ALWAYS update `PROGRESS.md` after every major decision or plan execution.

## High-Level Architecture

### "Native Black Box" Strategy
Monflo follows a high-reliability, privacy-first architecture where data capture and storage are decoupled from the application logic.

1.  **Capture (Native):** A Kotlin `NotificationListenerService` runs in the background as a **Foreground Service**. It captures UPI/bank alerts and writes the raw text directly into an encrypted **SQLCipher (AES-256)** database.
2.  **Handshake (Bridge):** When the app is active, the React Native layer performs a batch "Handshake" via `MonfloBridge`. It fetches pending raw alerts, processes them, and instructs the native layer to clear the inbox.
3.  **Parsing (TS):** The `UniversalParser.ts` uses on-device Regex logic to turn raw text into financial transactions. It includes a built-in **Promotional Filter** to discard rewards and ads.

### Data Flow
`System Notification` -> `MonfloNotificationService` -> `SQLCipher (Room)` -> `MonfloBridge` -> `UniversalParser` -> `Accounting Vault`.

### Code Structure (DDD)
The project is organized by **Bounded Contexts** across two layers (Native Kotlin + JS TypeScript):

- **Tracking Context**: Captures raw financial notifications and stores them in an encrypted vault.
    - Native: `android/app/src/main/java/com/monflo/tracking/` (Notification Service, SMS Receiver, SQLCipher DB)
    - JS: `src/domain/tracking/` (Universal Parser, Rule Manager, Handshake Service)
- **Accounting Context**: Categorized financial ledger, tags, and processed transaction storage.
    - JS: `src/domain/accounting/` (Repository interface and types)
- **Social Context**: CRDT-based P2P sync engine for bill splitting and payback detection.
    - JS: `src/domain/social/` (Automerge implementation, Waku/Relay networking, Invite management)
- **Presentation Layer**: React Native UI components.
    - JS: `src/presentation/` (App root, Dashboard, screens, components)

## Testing & Quality
- **Frameworks:** Vitest (primary), @testing-library/react-native (UI).
- **JS Logic:** 100% test coverage target. Unit tests match `src/` structure in `tests/`.
- **Accuracy:** All financial amounts are handled in **Paise (integers)** to prevent precision loss.
- **Privacy:** 100% Local-First. No financial data leaves the device except via E2EE sync in the Social context.

## Skill Routing
- Product ideas/brainstorming → invoke `/office-hours`
- Strategy/scope → invoke `/plan-ceo-review`
- Architecture → invoke `/plan-eng-review`
- UI/UX Design review → invoke `/plan-design-review`
- Shipping/landing code → invoke `/ship`
