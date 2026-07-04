import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  NativeModules,
} from 'react-native';
import { TestResult, runAll, getTestCount } from '../../dev/minitest';
import { NativeAccountingRepository } from '../../domain/accounting/NativeAccountingRepository';
import {
  CAPTURE_MODES,
  CaptureModeId,
  formatCapturesCsv,
  summarizeCaptures,
  CaptureSummary,
} from '../../dev/captureLab';

// Side-effect import registers the test tree into minitest's global suite list.
// This happens once when DevTestScreen first loads; re-runs reuse the same tree.
import '../../dev/testSuites';

const { MonfloBridge } = NativeModules;
const repository = new NativeAccountingRepository();
const isHermes = typeof (global as Record<string, unknown>).HermesInternal !== 'undefined';

interface Props {
  onBack: () => void;
  onOpenLiveMonitor?: () => void;
  onOpenSimulator?: () => void;
}

export const DevTestScreen: React.FC<Props> = ({ onBack, onOpenLiveMonitor, onOpenSimulator }) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [startMs, setStartMs] = useState(0);
  const [totalMs, setTotalMs] = useState(0);

  const total = getTestCount();
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  // --- Capture Lab: mode selection + export ---
  const [captureMode, setCaptureMode] = useState<CaptureModeId | null>(null);
  const [summary, setSummary] = useState<CaptureSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshSummary = useCallback(async () => {
    try {
      const txs = await repository.getByDateRange(0, Date.now() + 86_400_000);
      setSummary(summarizeCaptures(txs));
    } catch (e) {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const mode = await MonfloBridge?.getCaptureMode?.();
        if (mode) setCaptureMode(mode as CaptureModeId);
      } catch {}
      refreshSummary();
    })();
  }, [refreshSummary]);

  const selectMode = useCallback(async (id: CaptureModeId) => {
    try {
      const applied = await MonfloBridge?.setCaptureMode?.(id);
      setCaptureMode((applied as CaptureModeId) ?? id);
    } catch (e) {
      Alert.alert('Capture mode', `Failed to set mode: ${String(e)}`);
    }
  }, []);

  const exportCsv = useCallback(async () => {
    setBusy(true);
    try {
      const txs = await repository.getByDateRange(0, Date.now() + 86_400_000);
      setSummary(summarizeCaptures(txs));
      if (txs.length === 0) {
        Alert.alert('Export', 'No captured transactions yet.');
        return;
      }
      await Share.share({
        title: 'Monflo capture export',
        message: formatCapturesCsv(txs),
      });
    } catch (e) {
      Alert.alert('Export', `Failed: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

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

      {/* Capture Lab: pick a source mode, then export what was captured */}
      <View style={styles.lab}>
        <Text style={styles.labTitle}>CAPTURE LAB</Text>
        {CAPTURE_MODES.map((m) => {
          const active = captureMode === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeRow, active && styles.modeRowActive]}
              onPress={() => selectMode(m.id)}
            >
              <Text style={styles.modeDot}>{active ? '◉' : '○'}</Text>
              <View style={styles.modeBody}>
                <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{m.label}</Text>
                <Text style={styles.modeDesc}>{m.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.labActions}>
          <TouchableOpacity style={styles.labBtn} onPress={refreshSummary} disabled={busy}>
            <Text style={styles.labBtnText}>Reload</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.labBtn, styles.labBtnPrimary]} onPress={exportCsv} disabled={busy}>
            <Text style={styles.labBtnText}>{busy ? 'Exporting…' : 'Export CSV'}</Text>
          </TouchableOpacity>
        </View>

        {summary && (
          <Text style={styles.labSummary}>
            {summary.total} captured · {summary.parsed} parsed · {summary.unparsed} unparsed
            {' · '}{Math.round(summary.parseRate * 100)}% hit
            {'  (app '}{summary.fromApp}{' / sms '}{summary.fromSms}{')'}
          </Text>
        )}
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

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.runButton, running && styles.runButtonDisabled]}
          onPress={runTests}
          disabled={running}
        >
          <Text style={styles.runButtonText}>
            {running ? 'Running…' : results.length > 0 ? 'Run Again' : 'Run Tests'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.monitorButton}
          onPress={onOpenLiveMonitor}
        >
          <Text style={styles.monitorButtonText}>Live Monitor →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.monitorButton}
          onPress={onOpenSimulator}
        >
          <Text style={styles.monitorButtonText}>Simulator →</Text>
        </TouchableOpacity>
      </View>

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
  lab: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  labTitle: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modeRowActive: {},
  modeDot: {
    color: '#3b82f6',
    fontSize: 14,
    width: 22,
  },
  modeBody: {
    flex: 1,
  },
  modeLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  modeLabelActive: {
    color: '#f3f4f6',
  },
  modeDesc: {
    color: '#4b5563',
    fontSize: 11,
  },
  labActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  labBtn: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  labBtnPrimary: {
    backgroundColor: '#3b82f6',
  },
  labBtnText: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: '700',
  },
  labSummary: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 10,
    fontFamily: 'monospace',
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
  actionRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  runButton: {
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
  monitorButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  monitorButtonText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
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
