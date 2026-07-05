import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  NativeModules,
} from 'react-native';
import { UniversalParser } from '../../domain/tracking/UniversalParser';

const { MonfloBridge } = NativeModules;

interface RawAlertJS {
  id: number;
  rawText: string;
  packageName: string;
  timestamp: number;
}

interface MonitorEntry {
  id: number;
  ts: number;
  rawText: string;
  packageName: string;
  parsed: ReturnType<typeof UniversalParser.parse>;
}

interface Props {
  onBack: () => void;
}

export const LiveMonitorScreen: React.FC<Props> = ({ onBack }) => {
  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const seenIds = useRef(new Set<number>());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing LIVE dot animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Poll every 2 seconds — observe only, never clears alerts
  useEffect(() => {
    const tick = async () => {
      try {
        const alerts: RawAlertJS[] = await (MonfloBridge?.getPendingAlerts() ?? []);
        const newEntries: MonitorEntry[] = [];
        for (const alert of alerts) {
          if (!seenIds.current.has(alert.id)) {
            seenIds.current.add(alert.id);
            const parsed = UniversalParser.parse(alert.rawText, alert.packageName);
            newEntries.push({
              id: alert.id,
              ts: alert.timestamp,
              rawText: alert.rawText,
              packageName: alert.packageName,
              parsed,
            });
          }
        }
        if (newEntries.length > 0) {
          setEntries(prev => [...newEntries.reverse(), ...prev]);
        }
      } catch {
        // DB not ready yet — silently retry next tick
      }
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = useCallback(() => {
    seenIds.current.clear();
    setEntries([]);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Live Monitor</Text>
          <Text style={styles.captureCount}>
            {entries.length} captured
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
      </View>

      {/* Clear button */}
      <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
        <Text style={styles.clearText}>Clear feed</Text>
      </TouchableOpacity>

      {/* Feed */}
      <ScrollView style={styles.feed} contentContainerStyle={styles.feedContent}>
        {entries.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Waiting for alerts…</Text>
            <Text style={styles.emptyHint}>
              Send a bank SMS or trigger a UPI notification.{'\n'}
              New alerts appear here within 2 seconds.
            </Text>
          </View>
        )}
        {entries.map(entry => (
          <AlertCard key={entry.id} entry={entry} />
        ))}
      </ScrollView>
    </View>
  );
};

const AlertCard: React.FC<{ entry: MonitorEntry }> = ({ entry }) => {
  const time = new Date(entry.ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isNotification = entry.packageName && !entry.packageName.startsWith('sms:');
  const sourceLabel = isNotification ? 'NOTIF' : 'SMS';
  const sourceBadgeStyle = isNotification ? styles.badgeNotif : styles.badgeSms;

  const p = entry.parsed;
  const parsedOk = p !== null;

  return (
    <View style={styles.card}>
      {/* Card header row */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTime}>{time}</Text>
        <Text style={styles.cardSource} numberOfLines={1} ellipsizeMode="middle">
          {entry.packageName}
        </Text>
        <View style={[styles.badge, sourceBadgeStyle]}>
          <Text style={styles.badgeText}>{sourceLabel}</Text>
        </View>
      </View>

      {/* Raw text */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RAW</Text>
        <Text style={styles.rawText}>{entry.rawText}</Text>
      </View>

      {/* Parsed result */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, parsedOk ? styles.parsedOkLabel : styles.parsedFailLabel]}>
          PARSED {parsedOk ? '✓' : '✗'}
        </Text>
        {parsedOk ? (
          <View>
            <Text style={styles.parsedMain}>
              {formatAmount(p!.amountPaise)} · {p!.events[0]?.type ?? '—'} · {p!.events[0]?.merchantName ?? '(no merchant)'} · {formatCategory(p!.events[0]?.merchantName)}
            </Text>
            <Text style={styles.parsedMeta}>
              Trust: {p!.trustLevel} · {p!.templateId ?? 'FSM fallback'}
            </Text>
          </View>
        ) : (
          <Text style={styles.parseFailed}>Parse returned null — no financial event detected</Text>
        )}
      </View>
    </View>
  );
};

function formatAmount(paise: number): string {
  const sign = paise < 0 ? '+' : '-';
  const abs = Math.abs(paise) / 100;
  return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCategory(merchantName: string | null | undefined): string {
  if (!merchantName) return 'untagged';
  return merchantName; // category resolution happens in MerchantDetector; just show merchant here
}

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
  headerTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '700',
  },
  captureCount: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  headerRight: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveLabel: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
  },
  clearButton: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignSelf: 'flex-end',
  },
  clearText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    gap: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyHint: {
    color: '#374151',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    gap: 8,
  },
  cardTime: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 0,
  },
  cardSource: {
    flex: 1,
    color: '#4b5563',
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  badgeSms: {
    backgroundColor: '#1e3a5f',
  },
  badgeNotif: {
    backgroundColor: '#2d1b4e',
  },
  badgeText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '700',
  },
  section: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
    color: '#4b5563',
  },
  parsedOkLabel: {
    color: '#16a34a',
  },
  parsedFailLabel: {
    color: '#dc2626',
  },
  rawText: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  parsedMain: {
    color: '#d1fae5',
    fontSize: 13,
    fontWeight: '600',
  },
  parsedMeta: {
    color: '#4b5563',
    fontSize: 11,
    marginTop: 3,
  },
  parseFailed: {
    color: '#ef4444',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
