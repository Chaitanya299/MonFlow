import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  NativeModules,
} from 'react-native';
import { NativeAccountingRepository } from '../../domain/accounting/NativeAccountingRepository';
import { ProcessedTransaction, DailySummary } from '../../domain/accounting/types';
import { TransactionItem } from '../components/TransactionItem';
import { runHandshake } from '../../domain/tracking/AlertHandshake';

const { MonfloBridge } = NativeModules;
const repository = new NativeAccountingRepository();

interface Props {
  onOpenUntagged: () => void;
  onOpenDevTest?: () => void;
  onOpenPermissions?: () => void;
}

export const Dashboard: React.FC<Props> = ({ onOpenUntagged, onOpenDevTest, onOpenPermissions }) => {
  const tapCountRef = useRef(0);
  const lastTapRef = useRef(0);

  const handleTitlePress = () => {
    const now = Date.now();
    tapCountRef.current = (now - lastTapRef.current > 3000) ? 1 : tapCountRef.current + 1;
    lastTapRef.current = now;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      onOpenDevTest?.();
    }
  };
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [captureStale, setCaptureStale] = useState(false);

  // Detects a silently-dead capture pipeline (OEM battery killer took out the
  // notification listener process). Reuses this screen's own fetch/refresh
  // cadence instead of adding a separate poll timer.
  const checkCaptureHealth = async () => {
    try {
      const trackingEnabled = await (MonfloBridge?.isTrackingEnabled?.() ?? Promise.resolve(false));
      if (!trackingEnabled) {
        setCaptureStale(false);
        return;
      }
      const health = await MonfloBridge?.getCaptureHealth?.();
      if (!health || health.lastHeartbeatMs === 0) {
        setCaptureStale(false); // never started yet — not a failure
        return;
      }
      setCaptureStale(health.nowMs - health.lastHeartbeatMs > health.staleThresholdMs);
    } catch {
      setCaptureStale(false);
    }
  };

  const fetchData = async () => {
    try {
      // Trigger handshake to get latest notifications before listing
      await runHandshake();

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const [txs, daySummary, untagged] = await Promise.all([
        repository.getByDateRange(now.getTime() - 7 * 24 * 60 * 60 * 1000, now.getTime() + 10000),
        repository.getDailySummary(todayStr),
        repository.getUntagged(),
        checkCaptureHealth(),
      ]);

      setTransactions(txs);
      setSummary(daySummary);
      setUntaggedCount(untagged.length);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello,</Text>
        <TouchableOpacity onPress={handleTitlePress} activeOpacity={1}>
          <Text style={styles.title}>Your Vault</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>TODAY'S SPENDING</Text>
        <Text style={styles.summaryAmount}>
          ₹{( (summary?.totalSpentPaise || 0) / 100).toFixed(2)}
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summarySubtext}>{summary?.transactionCount || 0} Transactions</Text>
          <Text style={styles.summarySubtext}>100% Local</Text>
        </View>
      </View>

      {captureStale && (
        <TouchableOpacity style={styles.captureWarningBanner} onPress={onOpenPermissions}>
          <Text style={styles.captureWarningText}>
            Capture may be paused — tap to check permissions
          </Text>
          <Text style={styles.captureWarningAction}>FIX →</Text>
        </TouchableOpacity>
      )}

      {untaggedCount > 0 && (
        <TouchableOpacity style={styles.alertBanner} onPress={onOpenUntagged}>
          <Text style={styles.alertText}>
            You have {untaggedCount} new items to reconcile
          </Text>
          <Text style={styles.alertAction}>REVIEW →</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Recent Activity</Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} color="#000000" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions captured yet.</Text>
            <Text style={styles.emptySubtext}>Waiting for UPI or Bank notifications...</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 60,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#888888',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#aaaaaa',
    fontWeight: '700',
    letterSpacing: 1,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 12,
  },
  summarySubtext: {
    fontSize: 12,
    color: '#888888',
  },
  alertBanner: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  alertText: {
    fontSize: 14,
    color: '#e65100',
    fontWeight: '600',
  },
  alertAction: {
    fontSize: 12,
    color: '#ef6c00',
    fontWeight: '800',
    letterSpacing: 1,
  },
  captureWarningBanner: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  captureWarningText: {
    fontSize: 14,
    color: '#c62828',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  captureWarningAction: {
    fontSize: 12,
    color: '#b71c1c',
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  list: {
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444444',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
  },
});
