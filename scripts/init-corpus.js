import * as fs from 'fs';
import * as path from 'path';

/**
 * Monflo Corpus Initializer
 *
 * Populates the initial test corpus with anonymized samples for common
 * Indian bank formats and UPI apps.
 */
const CORPUS_DIR = path.resolve('test-data/corpus');

const INITIAL_SAMPLES = [
  // GPay
  {
    category: 'gpay',
    input: 'Paid ₹1,500.50 to Zomato',
    expected: { amount: 150050, currency: 'INR' }
  },
  {
    category: 'gpay',
    input: '₹200 received from User',
    expected: { amount: -20000, currency: 'INR' }
  },

  // PhonePe
  {
    category: 'phonepe',
    input: 'Payment of ₹500 to Swiggy successful',
    expected: { amount: 50000, currency: 'INR' }
  },

  // HDFC
  {
    category: 'hdfc',
    input: 'Rs.1,200.00 debited from A/c XX4512 on 16-MAY-26 to User. Info: UPI-SWIGGY.',
    expected: { amount: 120000, currency: 'INR' }
  },

  // SBI
  {
    category: 'sbi',
    input: 'Your A/c XXXXXX1234 has been debited by Rs 2,500.00 on 2026-05-16. (Ref: 1234567890)',
    expected: { amount: 250000, currency: 'INR' }
  },

  // ICICI
  {
    category: 'icici',
    input: 'i-Safe: Trans of INR 450.75 on ICICI Bank Card XX1001. Merchant: AMAZON PAY.',
    expected: { amount: 45075, currency: 'INR' }
  }
];

function getTargetFile(sample) {
  const input = (sample.input || '').toLowerCase();
  const expected = sample.expected;

  if (input.includes('promo') || input.includes('special offer')) {
    return 'promo.json';
  }
  if (input.includes('fake-sbi')) {
    return 'scam.json';
  }
  if (input.includes('ignored') || expected === null) {
    return 'ignored.json';
  }
  if (input.includes('refund')) {
    return 'refund.json';
  }
  if (input.includes('reversal')) {
    return 'reversal.json';
  }
  if (input.includes('lite:')) {
    return 'upi_lite.json';
  }
  if (input.includes('cashback')) {
    return 'cashback.json';
  }
  if (input.includes('statement')) {
    return 'statement.json';
  }
  if (input.includes('failed')) {
    return 'failed.json';
  }
  if (input.includes('credited') || input.includes('received')) {
    return 'credit.json';
  }
  if (input.includes('debited') || input.includes('sent') || input.includes('spent') || input.includes('paid')) {
    return 'debit.json';
  }

  // Fallbacks
  if (expected && expected.amount < 0) {
    return 'credit.json';
  }
  if (expected && expected.amount > 0) {
    return 'debit.json';
  }

  return 'unknown.json';
}

function initialize() {
  console.log('🏗️  Initializing Test Corpus...');

  const groups = {};
  INITIAL_SAMPLES.forEach((sample, index) => {
    const cat = sample.category;
    const targetFile = getTargetFile(sample);
    if (!groups[cat]) {
      groups[cat] = {};
    }
    if (!groups[cat][targetFile]) {
      groups[cat][targetFile] = [];
    }
    const cleanSample = {
      category: sample.category,
      input: sample.input,
      expected: sample.expected,
      id: `${sample.category}_init_${index + 1}`
    };
    groups[cat][targetFile].push(cleanSample);
  });

  Object.keys(groups).forEach(cat => {
    const providerDir = path.join(CORPUS_DIR, cat);
    if (!fs.existsSync(providerDir)) {
      fs.mkdirSync(providerDir, { recursive: true });
    }
    Object.keys(groups[cat]).forEach(targetFile => {
      const filePath = path.join(providerDir, targetFile);
      fs.writeFileSync(filePath, JSON.stringify(groups[cat][targetFile], null, 2));
      console.log(`✅ Created ${cat} array: ${targetFile}`);
    });
  });

  console.log('\n🌟 Corpus initialized with 6 core samples across 5 providers.');
}

initialize();
