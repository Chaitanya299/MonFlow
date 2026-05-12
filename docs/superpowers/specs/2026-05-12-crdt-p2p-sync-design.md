# Design Spec: Monflo CRDT-based P2P Sync Engine

**Status:** DRAFT  
**Date:** 2026-05-12  
**Author:** Antigravity (Claude)  

## 1. Overview
Fulfill the "Multiplayer Magic" promise of Monflo while maintaining "Extreme Privacy" through a local-first, decentralized sync engine. This design replaces central servers with a peer-to-peer gossip network (Waku) and mathematical consistency models (CRDTs).

## 2. Identity & Trust Model

### 2.1 UPI-Style Verification (SIM Binding)
1. **Verification:** Phone number verified via SMS OTP on first launch.
2. **Key Generation:** A unique Ed25519 keypair is generated and stored in the Android Keystore (hardware-backed).
3. **Identity Binding:** The user's public key is cryptographically bound to their phone number. This prevents identity theft and ensures you only split bills with verified friends.

### 2.2 Peer Discovery
- **Initial Handshake:** Handled via the 4-tier discovery suite (Bluetooth, QR, Invite Links).
- **Global Discovery:** Once two peers have exchanged public keys, they find each other on the global relay network using their hashed public keys as "Topic IDs."

## 3. Data Architecture (Automerge)

### 3.1 Document Schema
Each `SplitGroup` is a standalone Automerge document.
- `id`: UUID.
- `metadata`: { name, createdAt, createdBy }.
- `members`: Map<PhoneNumberHash, MemberProfile>.
- `transactions`: Map<UUID, TransactionRecord>.
- `settlements`: Map<UUID, SettlementRecord>.

### 3.2 Conflict Resolution
- **Merge Strategy:** Concurrent updates to independent fields (e.g., adding different transactions) are merged automatically.
- **Deterministic Tie-Breaker:** For concurrent edits to the same field (e.g., changing group name), the update from the peer with the lexicographically higher public key wins.

## 4. Networking & Sync Strategy

### 4.1 Failover Transport Protocol
- **Primary: Waku Relay (Gossip).** Broadcasts encrypted CRDT "Ops" over a decentralized network. Zero metadata footprint.
- **Fallback: Monflo Private Relay (WebSockets).** A simple "blind" mailbox for encrypted blobs. Used if Waku is blocked or high-latency.
- **Privacy:** All payloads are AES-256 GCM encrypted using the group's shared secret key before transmission.

### 4.2 Snapshot Pruning (Performance)
- **Compaction:** Once per week (or every 500 ops), the app generates a compressed state snapshot.
- **Garbage Collection:** Old historical operations are purged locally after being merged into the snapshot. This maintains "Industry Level" speed on mid-range Android devices.

## 5. Success Criteria
- Two friends in different locations can both add an expense and see the correct, merged ledger within 10 seconds.
- Total spending data never exists in plaintext on any server (Waku or Private Relay).
- Identity verification prevents unauthorized peers from joining a private split group.

## 6. NOT in scope (v1)
- Rich media attachments (images/receipts) in the P2P sync.
- Public/Open split groups (all groups are invite-only).
