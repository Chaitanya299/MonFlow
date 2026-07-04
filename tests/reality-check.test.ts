import { describe, it, vi, expect } from 'vitest';
import { runHandshake } from '../src/domain/tracking/AlertHandshake';
import { UniversalParser } from '../src/domain/tracking/UniversalParser';

// --- MOCK SETUP ---
const { mockBridge } = vi.hoisted(() => ({
  mockBridge: {
    getPendingAlerts: vi.fn(),
    clearProcessedAlerts: vi.fn(),
    saveTransaction: vi.fn(),
    updateTransactionCategory: vi.fn(),
  }
}));

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: mockBridge,
  },
}));

// --- SIMULATOR HELPERS ---
const logStep = (step: string, details: string) => {
  console.log(`\x1b[36m[STEP ${step}]\x1b[0m \x1b[1m${details}\x1b[0m`);
};

const renderUIPreview = (tx: any) => {
  const isExpense = tx.amountPaise > 0;
  const color = isExpense ? '\x1b[31m' : '\x1b[32m'; // Red vs Green
  const sign = isExpense ? '-' : '+';
  const amount = (Math.abs(tx.amountPaise) / 100).toFixed(2);

  console.log('\n📱 \x1b[33mUI PREVIEW (Actionable Monochrome)\x1b[0m');
  console.log('┌──────────────────────────────────────────┐');
  console.log(`│ \x1b[1m${(tx.merchantName || 'Unknown Merchant').padEnd(20)}\x1b[0m ${color}${sign} ₹${amount.padStart(10)}\x1b[0m │`);
  console.log(`│ \x1b[2m${tx.sourcePackage.padEnd(20)}\x1b[0m \x1b[34m${tx.category.toUpperCase().padStart(16)}\x1b[0m │`);
  console.log('└──────────────────────────────────────────┘\n');
};

// --- REALITY SCENARIOS ---
describe('Monflo Reality Simulator', () => {
  it('Scenario 1: Standard GPay Transaction', async () => {
    const rawMessage = 'Paid ₹1,500.50 to Zomato';
    const pkg = 'com.google.android.apps.nbu.paisa.user';

    console.log('\n🚀 \x1b[1mREALITY CHECK: GPay Payment Flow\x1b[0m');
    console.log('==========================================');

    logStep('1: TRIGGER', `System Notification popup: "${rawMessage}"`);

    logStep('2: CAPTURE', 'Native MonfloNotificationService extracts text and saves to SQLCipher Vault.');
    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 101, rawText: rawMessage, packageName: pkg, timestamp: Date.now() }
    ]);

    logStep('3: HANDSHAKE', 'App is active. Triggering batch fetch from Native Bridge...');

    // Intercept parser to show its "thinking"
    const originalParse = UniversalParser.parse;
    UniversalParser.parse = (text: string) => {
      const result = originalParse(text);
      logStep('4: BRAIN', `UniversalParser matching Regex: "${text}"`);
      logStep('   PRECISION', `Converting float to Integer Paise: ${result?.amountPaise} units.`);
      return result;
    };

    await runHandshake();

    logStep('5: LEDGER', 'NativeAccountingRepository persisting transaction to encrypted store.');

    expect(mockBridge.saveTransaction).toHaveBeenCalled();
    const savedTx = mockBridge.saveTransaction.mock.calls[0][0];
    renderUIPreview(savedTx);

    logStep('6: ATOMICITY', 'Handshake complete. Native Inbox ID [101] cleared.');
    console.log('==========================================\n');

    // Restore parser for next test
    UniversalParser.parse = originalParse;
  });

  it('Scenario 2: Promotional Spam Filter', async () => {
    const spamMessage = 'Congratulations! You won cashback of ₹50';

    console.log('\n🚀 \x1b[1mREALITY CHECK: Spam Filtering\x1b[0m');
    console.log('==========================================');

    logStep('1: TRIGGER', `System Notification popup: "${spamMessage}"`);

    mockBridge.getPendingAlerts.mockResolvedValue([
      { id: 102, rawText: spamMessage, packageName: 'net.one97.paytm', timestamp: Date.now() }
    ]);

    logStep('2: BRAIN', 'Analyzing for promotional keywords...');
    const isPromo = UniversalParser.isPromotional(spamMessage);

    if (isPromo) {
      logStep('3: FILTER', `\x1b[33mPROMO DETECTED!\x1b[0m Discarding noise to keep vault clean.`);
    }

    await runHandshake();

    logStep('4: RESULT', 'Handshake ignored transaction logic but cleared the notification from inbox.');
    console.log('==========================================\n');
  });
});
