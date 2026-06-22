const fs = require('fs');
const path = require('path');

const CORPUS_DIR = path.resolve(__dirname, '../test-data/corpus');

function getTargetFile(filename, sample) {
  const name = filename.toLowerCase();
  const id = (sample.id || '').toLowerCase();
  const input = (sample.input || '').toLowerCase();
  const expected = sample.expected;

  if (name.includes('promo') || id.includes('promo') || input.includes('promo') || input.includes('special offer')) {
    return 'promo.json';
  }
  if (name.includes('scam') || id.includes('scam') || input.includes('fake-sbi')) {
    return 'scam.json';
  }
  if (name.includes('ignored') || id.includes('ignored')) {
    return 'ignored.json';
  }
  if (name.includes('refund') || id.includes('refund') || input.includes('refund')) {
    return 'refund.json';
  }
  if (name.includes('reversal') || id.includes('reversal') || input.includes('reversal')) {
    return 'reversal.json';
  }
  if (name.includes('lite') || id.includes('lite') || input.includes('lite:')) {
    return 'upi_lite.json';
  }
  if (name.includes('cashback') || id.includes('cashback') || input.includes('cashback')) {
    return 'cashback.json';
  }
  if (name.includes('statement') || id.includes('statement') || input.includes('statement')) {
    return 'statement.json';
  }
  if (name.includes('failed') || id.includes('failed') || input.includes('failed')) {
    return 'failed.json';
  }
  if (name.includes('credit') || id.includes('credit') || input.includes('credited') || input.includes('received')) {
    return 'credit.json';
  }
  if (name.includes('debit') || id.includes('debit') || input.includes('debited') || input.includes('sent') || input.includes('spent') || input.includes('paid')) {
    return 'debit.json';
  }

  // Heuristic-based fallbacks based on expected values
  if (expected === null) {
    return 'ignored.json';
  }
  if (expected && expected.amount < 0) {
    return 'credit.json';
  }
  if (expected && expected.amount > 0) {
    return 'debit.json';
  }

  return 'unknown.json';
}

function consolidate() {
  console.log('🔄 Starting Test Corpus Consolidation...');

  if (!fs.existsSync(CORPUS_DIR)) {
    console.error(`Corpus directory not found at: ${CORPUS_DIR}`);
    process.exit(1);
  }

  const providers = fs.readdirSync(CORPUS_DIR);
  let totalMigrated = 0;
  let filesDeletedCount = 0;

  providers.forEach(provider => {
    const providerPath = path.join(CORPUS_DIR, provider);
    if (!fs.statSync(providerPath).isDirectory()) return;

    console.log(`\n📂 Processing provider: ${provider}`);
    const files = fs.readdirSync(providerPath);

    // Group samples by target file
    const groups = {};

    const filesToDelete = [];

    files.forEach(file => {
      // Only process individual sample json files (skipping already consolidated files if re-run)
      if (!file.endsWith('.json')) return;
      if (['credit.json', 'debit.json', 'refund.json', 'reversal.json', 'upi_lite.json', 'cashback.json', 'statement.json', 'failed.json', 'ignored.json', 'promo.json', 'scam.json', 'unknown.json'].includes(file)) {
        return;
      }

      const filePath = path.join(providerPath, file);
      try {
        const sample = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const targetFile = getTargetFile(file, sample);

        if (!groups[targetFile]) {
          groups[targetFile] = [];
        }

        // Clean up sample object (ensure expected structure is normalized)
        const cleanSample = {
          category: sample.category || provider,
          input: sample.input,
          expected: sample.expected
        };
        if (sample.id) cleanSample.id = sample.id;
        if (sample.sourcePackage) cleanSample.sourcePackage = sample.sourcePackage;

        groups[targetFile].push(cleanSample);
        filesToDelete.push(filePath);
        totalMigrated++;
      } catch (err) {
        console.error(`❌ Failed to read or parse file: ${file}`, err);
      }
    });

    // Write consolidated files
    Object.keys(groups).forEach(targetFile => {
      const targetPath = path.join(providerPath, targetFile);
      let existingSamples = [];
      if (fs.existsSync(targetPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
          if (Array.isArray(content)) {
            existingSamples = content;
          }
        } catch (e) {
          console.warn(`⚠️ Warning: could not parse existing ${targetPath}, overwriting.`);
        }
      }

      // Merge new samples into existing if any, avoiding exact duplicates by input text
      const mergedSamples = [...existingSamples];
      groups[targetFile].forEach(newSample => {
        const isDuplicate = mergedSamples.some(s => s.input === newSample.input);
        if (!isDuplicate) {
          mergedSamples.push(newSample);
        }
      });

      fs.writeFileSync(targetPath, JSON.stringify(mergedSamples, null, 2), 'utf-8');
      console.log(`  📝 Wrote ${groups[targetFile].length} samples to ${targetFile}`);
    });

    // Delete old individual files
    filesToDelete.forEach(filePath => {
      try {
        fs.unlinkSync(filePath);
        filesDeletedCount++;
      } catch (err) {
        console.error(`❌ Failed to delete file: ${filePath}`, err);
      }
    });
  });

  console.log(`\n✨ Consolidation complete!`);
  console.log(`📊 Total samples migrated/processed: ${totalMigrated}`);
  console.log(`🗑️ Total individual files deleted: ${filesDeletedCount}`);
}

consolidate();
