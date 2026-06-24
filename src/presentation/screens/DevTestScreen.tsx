import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { TestResult, runAll, getTestCount } from '../../dev/minitest';

// Side-effect import registers the test tree into minitest's global suite list.
// This happens once when DevTestScreen first loads; re-runs reuse the same tree.
import '../../dev/testSuites';

const isHermes = typeof (global as Record<string, unknown>).HermesInternal !== 'undefined';

interface Props {
  onBack: () => void;
}

export const DevTestScreen: React.FC<Props> = ({ onBack }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [startMs, setStartMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);

  const total = getTestCount();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  const runTests = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const t0 = Date.now();
    setStartMs(t0);

    await runAll((result) => {
      setResults(prev => [...prev, result]);
    });

    setTotalMs(Date.now() - t0);
    setRunning(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Dev Test Runner</Text>
          <Text style={[styles.hermesTag, isHermes ? styles.hermesOn : styles.hermesOff]}>
            Hermes: {isHermes ? '✓' : '✗'}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: total > 0
                  ? `${Math.round((results.length / total) * 100)}%`
                  : '0%',
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {results.length}/{total}
        </Text>
      </View>

      {/* Run button */}
      <TouchableOpacity
        style={[styles.runButton, running && styles.runButtonDisabled]}
        onPress={runTests}
        disabled={running}
      >
        <Text style={styles.runButtonText}>
          {running ? 'Running…' : results.length > 0 ? 'Run Again' : 'Run Tests'}
        </Text>
      </TouchableOpacity>

      {/* Results list */}
      <ScrollView style={styles.results} contentContainerStyle={styles.resultsList}>
        {results.map((r, i) => (
          <View key={i} style={[styles.row, r.passed ? styles.rowPass : styles.rowFail]}>
            <Text style={styles.rowDot}>{r.passed ? '●' : '✕'}</Text>
            <View style={styles.rowBody}>
              <Text style={[styles.rowName, r.passed ? styles.rowNamePass : styles.rowNameFail]}>
                {r.suite} › {r.name}
              </Text>
              {!r.passed && r.error && (
                <Text style={styles.rowError}>{r.error}</Text>
              )}
            </View>
            <Text style={styles.rowTime}>{r.durationMs}ms</Text>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      {results.length > 0 && !running && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerPass}>{passed} passed</Text>
            {' · '}
            <Text style={failed > 0 ? styles.footerFail : styles.footerZeroFail}>
              {failed} failed
            </Text>
            {' · '}
            {totalMs}ms total
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  backButton: {
    width: 72,
  },
  backText: {
    color: '#6b7280',
    fontSize: 14,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 72,
  },
  headerTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '700',
  },
  hermesTag: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  hermesOn: {
    color: '#22c55e',
  },
  hermesOff: {
    color: '#ef4444',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#1e1e1e',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  progressLabel: {
    color: '#6b7280',
    fontSize: 12,
    width: 48,
    textAlign: 'right',
  },
  runButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  runButtonDisabled: {
    backgroundColor: '#1d4ed8',
    opacity: 0.6,
  },
  runButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  results: {
    flex: 1,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  rowPass: {},
  rowFail: {
    backgroundColor: '#1a0a0a',
  },
  rowDot: {
    fontSize: 10,
    width: 16,
    marginTop: 2,
    color: '#6b7280',
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 12,
  },
  rowNamePass: {
    color: '#9ca3af',
  },
  rowNameFail: {
    color: '#f87171',
    fontWeight: '600',
  },
  rowError: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  rowTime: {
    fontSize: 11,
    color: '#4b5563',
    width: 44,
    textAlign: 'right',
    marginTop: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  footerPass: {
    color: '#22c55e',
    fontWeight: '600',
  },
  footerFail: {
    color: '#ef4444',
    fontWeight: '600',
  },
  footerZeroFail: {
    color: '#9ca3af',
  },
});
