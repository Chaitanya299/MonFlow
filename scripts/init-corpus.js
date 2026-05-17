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

function initialize() {
  console.log('🏗️  Initializing Test Corpus...');

  INITIAL_SAMPLES.forEach((sample, index) => {
    const providerDir = path.join(CORPUS_DIR, sample.category);
    if (!fs.existsSync(providerDir)) {
      fs.mkdirSync(providerDir, { recursive: true });
    }
    const filePath = path.join(providerDir, `sample-${index + 1}.json`);
    fs.writeFileSync(filePath, JSON.stringify(sample, null, 2));
    console.log(`✅ Created ${sample.category} sample: ${path.basename(filePath)}`);
  });

  console.log('\n🌟 Corpus initialized with 6 core samples across 5 providers.');
}

initialize();
