import * as Automerge from '@automerge/automerge';
import { describe, it, expect } from 'vitest';

// --- TYPES ---
interface SplitGroupDoc {
  id: string;
  name: string;
  transactions: Record<string, any>;
  members: Record<string, any>;
}

// --- SIMULATOR ---
describe('Automerge Conflict & Sync Simulation', () => {
  const logState = (peerName: string, doc: any) => {
    console.log(`\n\x1b[35m[PEER: ${peerName}]\x1b[0m Group: "${doc.name}" | Transactions: ${Object.keys(doc.transactions).length}`);
  };

  it('Scenario: Concurrent Edits (Group Name & Independent Transactions)', async () => {
    console.log('\n🚀 STARTING CRDT CONFLICT SIMULATION');
    console.log('====================================');

    // 1. Initial State (Shared Base)
    let docAlice = Automerge.init<SplitGroupDoc>();
    docAlice = Automerge.change(docAlice, (d) => {
      d.id = 'group-123';
      d.name = 'Trip to Goa';
      d.transactions = {};
      d.members = { 'alice-pk': { name: 'Alice' }, 'bob-pk': { name: 'Bob' } };
    });

    // Bob receives Alice's initial state
    let docBob = Automerge.load<SplitGroupDoc>(Automerge.save(docAlice));

    console.log('STEP 1: Initialized "Trip to Goa" on both devices.');

    // 2. CONCURRENT ACTION: Both go offline and make changes
    console.log('\nSTEP 2: Alice and Bob go offline and make concurrent changes...');

    // Alice changes group name
    docAlice = Automerge.change(docAlice, (d) => {
      d.name = 'Goa 2026! 🌴';
    });
    console.log('   [ALICE] Renamed group to "Goa 2026! 🌴"');

    // Bob adds a transaction
    docBob = Automerge.change(docBob, (d) => {
      d.transactions['tx-1'] = { amount: 1200, desc: 'Dinner', paidBy: 'Bob' };
    });
    console.log('   [BOB] Added "Dinner" transaction (₹1200)');

    // 3. SYNC: They come back online and merge
    console.log('\nSTEP 3: Syncing peers via Waku/Relay...');

    const aliceBinary = Automerge.save(docAlice);
    const bobBinary = Automerge.save(docBob);

    // Alice receives Bob's update
    docAlice = Automerge.merge(docAlice, Automerge.load<SplitGroupDoc>(bobBinary));
    // Bob receives Alice's update
    docBob = Automerge.merge(docBob, Automerge.load<SplitGroupDoc>(aliceBinary));

    logState('ALICE', docAlice);
    logState('BOB', docBob);

    // 4. VERIFICATION: Deterministic Consistency
    console.log('\nSTEP 4: Verifying deterministic consistency...');
    expect(docAlice.name).toBe(docBob.name);
    expect(Object.keys(docAlice.transactions)).toEqual(Object.keys(docBob.transactions));
    console.log('\x1b[32m✅ SUCCESS:\x1b[0m Both devices resolved to the exact same state without a server.');
  });

  it('Scenario: Concurrent Field Contention (Last-Write-Wins)', async () => {
    console.log('\n🚀 STARTING CONTENTION SIMULATION');
    console.log('====================================');

    let docAlice = Automerge.init<SplitGroupDoc>();
    docAlice = Automerge.change(docAlice, d => { d.name = 'Base'; d.transactions = {}; });
    let docBob = Automerge.load<SplitGroupDoc>(Automerge.save(docAlice));

    // Both change the SAME field
    docAlice = Automerge.change(docAlice, d => { d.name = 'Alice Choice'; });
    docBob = Automerge.change(docBob, d => { d.name = 'Bob Choice'; });

    console.log('STEP 1: Alice and Bob concurrently changed group name.');

    // Merge
    docAlice = Automerge.merge(docAlice, docBob);
    docBob = Automerge.merge(docBob, docAlice);

    console.log(`STEP 2: Merged. Winner: "${docAlice.name}"`);
    expect(docAlice.name).toBe(docBob.name);
    console.log('\x1b[32m✅ SUCCESS:\x1b[0m Deterministic tie-breaking verified.');
    console.log('====================================\n');
  });
});
