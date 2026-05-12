# CRDT-based P2P Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a decentralized, local-first sync engine using Automerge and Waku to enable private, global bill splitting with zero-server dependency.

**Architecture:** Each split group is an Automerge document. Updates are encrypted with a group-shared secret and broadcasted via Waku Relay. A private WebSocket relay acts as a failover mailbox. Hardware-backed Ed25519 keys bind identities to verified phone numbers.

**Tech Stack:** TypeScript, Automerge, Waku SDK, Ed25519 (TweetNaCl), React Native.

---

### Task 1: Automerge Core & Schema

**Files:**
- Create: `src/domain/social/SyncEngine.ts`
- Create: `src/domain/social/models/SplitGroup.ts`

- [ ] **Step 1: Define the Automerge document schema**

```typescript
import { Doc } from "@automerge/automerge";

export interface Member {
    id: string; // Hashed phone number
    pubKey: string; // Ed25519 Public Key
    name: string;
}

export interface Transaction {
    id: string;
    amountPaise: number;
    description: string;
    payerId: string;
    participants: string[]; // member IDs
    timestamp: number;
}

export interface SplitGroupDoc {
    id: string;
    name: string;
    members: Record<string, Member>;
    transactions: Record<string, Transaction>;
}
```

- [ ] **Step 2: Implement local doc operations (init, add transaction)**

- [ ] **Step 3: Commit**

```bash
git add src/domain/social/
git commit -m "feat: implement core Automerge document schema and local ops"
```

### Task 2: Identity & Hardware Binding

**Files:**
- Create: `src/domain/social/IdentityManager.ts`
- Modify: `android/app/src/main/java/com/monflo/tracking/MonfloModule.kt`

- [ ] **Step 1: Implement Ed25519 key generation in Android Keystore**

Expose `getPublicKey()` and `signMessage()` to JS via the bridge.

- [ ] **Step 2: Bind phone number to Public Key (Hashed Handshake)**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement hardware-backed identity binding (Ed25519)"
```

### Task 3: Waku Relay Integration (Primary Path)

**Files:**
- Create: `src/domain/social/network/WakuProvider.ts`

- [ ] **Step 1: Set up Waku node and Relay protocol**

- [ ] **Step 2: Implement Encrypted Broadcast (AES-256-GCM)**

Use the group's shared secret key to encrypt Automerge "Changes" before sending to the gossip network.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement primary sync path via Waku Relay"
```

### Task 4: Private Relay & Failover Logic

**Files:**
- Create: `src/domain/social/network/FailoverManager.ts`
- Create: `src/domain/social/network/RelayClient.ts`

- [ ] **Step 1: Implement WebSocket Relay client**

- [ ] **Step 2: Build the 5-second failover timer**

Primary (Waku) -> 5s Timeout -> Fallback (Relay).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement sync failover to private relay"
```

### Task 5: History Pruning & Snapshots

**Files:**
- Modify: `src/domain/social/SyncEngine.ts`

- [ ] **Step 1: Implement Automerge compaction (saveIncremental)**

- [ ] **Step 2: Build the Weekly Pruning logic (Purge old ops)**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: implement snapshot-based history pruning"
```
