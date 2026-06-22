import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('react-native', () => ({
  NativeModules: {
    MonfloBridge: {
      getRules: () => [],
      saveRules: () => {},
    },
  },
}));

import { UniversalParser } from '../src/domain/tracking/UniversalParser';
import { Deduplicator } from '../src/domain/tracking/Deduplicator';
import { TelemetryReporter } from '../src/domain/tracking/TelemetryReporter';

const CORPUS_DIR = path.resolve(__dirname, '../test-data/corpus');

describe('Monflo Reality Replay Harness', () => {
  beforeEach(() => {
    Deduplicator.clear();
    TelemetryReporter.clear();
  });

  const providers = fs.readdirSync(CORPUS_DIR);
  providers.forEach(provider => {
    const providerPath = path.join(CORPUS_DIR, provider);
    if (!fs.statSync(providerPath).isDirectory()) return;

    const files = fs.readdirSync(providerPath);
    files.forEach(file => {
      if (!file.endsWith('.json')) return;

      const content = JSON.parse(fs.readFileSync(path.join(providerPath, file), 'utf-8'));
      const samples = Array.isArray(content) ? content : [content];

      samples.forEach((sample, index) => {
        it(`should parse ${provider}/${file}[${index}]: "${sample.input}"`, () => {
          const sourcePackage = sample.sourcePackage || `sms:VM-${provider.toUpperCase()}-T`;

          const isPromo = UniversalParser.isPromotional(sample.input, sourcePackage);
          if (isPromo) {
            expect(sample.expected).toBeNull();
            return;
          }

          const parsed = UniversalParser.parse(sample.input, sourcePackage);
          if (!parsed) {
            expect(sample.expected).toBeNull();
            return;
          }

          expect(sample.expected).not.toBeNull();
          expect(parsed.amountPaise).toBe(sample.expected.amount);
        });
      });
    });
  });
});
