import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { UniversalParser } from '../../domain/tracking/UniversalParser';
import { Deduplicator } from '../../domain/tracking/Deduplicator';

const { MonfloBridge } = NativeModules;

// ponytail: representative real-world SMS/notification text — expand when new templates break
const PRESETS = [
  { label: 'PhonePe',    pkg: 'com.phonepe.app',                   text: 'You paid ₹500.00 to Swiggy Instamart' },
  { label: 'Google Pay', pkg: 'com.google.android.apps.nbu.paisa.user', text: 'You paid ₹1,200 to Zomato' },
  { label: 'Paytm',      pkg: 'net.one97.paytm',                   text: 'Paid ₹75.00 successfully to Zomato from Paytm Wallet' },
  { label: 'SuperMoney', pkg: 'com.supermoney.app',                 text: '₹2,000 paid to Amazon via SuperMoney UPI' },
  { label: 'Navi',       pkg: 'com.navi.android',                  text: 'Navi UPI: ₹650 sent to SWIG00123@okaxis' },
  { label: 'HDFC SMS',   pkg: 'sms:AD-HDFCBK-S',                  text: 'Txn Rs.500 On HDFC Bank Card 1580 At SWIGGY on 25-06-2026. Avl Limit Rs.45000' },
  { label: 'SBI SMS',    pkg: 'sms:AD-SBINBB',                     text: 'Your A/c no. XX1234 is debited for Rs.2500.00 on 25-06-2026, Info: AMAZON. Avl Bal Rs.12500.00 -SBI' },
  { label: 'ICICI SMS',  pkg: 'sms:AD-ICICIB',                     text: 'ICICI Bank: Rs 1500.00 debited from A/c XX5678 on 25-06-26 at ZOMATO. Avl Bal Rs 8900.00' },
  { label: 'Kotak SMS',  pkg: 'sms:VM-KOTAKB',                     text: 'Spent Rs.300.00 on Kotak Debit Card XX9999 at BLINKIT on 25-06-2026' },
  { label: 'Axis SMS',   pkg: 'sms:AD-AXISBK',                     text: 'Rs.850.00 debited from Acct XX4567 for SWIGGY on 25-06-2026 14:30. Avl Bal:Rs.5,234.50' },
] as const;

type ParseResult = ReturnType<typeof UniversalParser.parse>;

// SMS presets carry "sms:SENDER"; show the sender header as the notification title.
function titleFor(label: string, pkg: string): string {
  return pkg.startsWith('sms:') ? pkg.slice(4) : label;
}

interface Props {
  onBack: () => void;
}

export const NotifSimulatorScreen: React.FC<Props> = ({ onBack }) => {
  const [expanded, setExpanded] = useState<Record<string, ParseResult>>({});
  const [firing, setFiring] = useState<Set<string>>(new Set());

  // Android 13+ silently drops notify() without runtime POST_NOTIFICATIONS grant.
  useEffect(() => {
    if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
  }, []);

  const handleTapPreset = useCallback((label: string, text: string, pkg: string) => {
    setExpanded(prev => {
      if (label in prev) {
        const next = { ...prev };
        delete next[label];
        return next;
      }
      // Clear dedup so re-parsing the same preset always shows a fresh result.
      // The parser dedupes any sourcePackage !== 'app' within a 5-min window;
      // without this, the 2nd tap returns null → false "PARSE FAILED".
      Deduplicator.clear();
      return { ...prev, [label]: UniversalParser.parse(text, pkg) };
    });
  }, []);

  const handleFire = useCallback(async (label: string, text: string, pkg: string) => {
    if (!MonfloBridge?.postTestNotification) {
      Alert.alert('Native rebuild required', 'Rebuild the APK to enable real notifications + DB injection.');
      return;
    }
    setFiring(prev => new Set(prev).add(label));
    try {
      // 1. Real heads-up notification (notification center + pop-up)
      await MonfloBridge.postTestNotification(titleFor(label, pkg), text);
      // 2. Inject with the correct package so LiveMonitor shows accurate per-app parse
      //    (a posted notification would arrive as com.monflo, losing app routing)
      Deduplicator.clear();
      await MonfloBridge.injectTestAlert?.(text, pkg);
    } catch (e) {
      Alert.alert('Fire failed', String(e));
    } finally {
      setFiring(prev => {
        const next = new Set(prev);
        next.delete(label);
        return next;
      });
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notification Simulator</Text>
          <Text style={styles.headerSub}>tap row to parse · 🔔 to fire real notif</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {PRESETS.map(preset => {
          const isExpanded = preset.label in expanded;
          const parseResult = expanded[preset.label];
          const isFiring = firing.has(preset.label);
          const isSms = preset.pkg.startsWith('sms:');

          return (
            <View key={preset.label}>
              <TouchableOpacity
                style={styles.presetRow}
                onPress={() => handleTapPreset(preset.label, preset.text, preset.pkg)}
                activeOpacity={0.7}
              >
                <View style={styles.presetLeft}>
                  <View style={styles.presetLabelRow}>
                    <Text style={styles.presetLabel}>{preset.label}</Text>
                    <View style={[styles.badge, isSms ? styles.badgeSms : styles.badgeNotif]}>
                      <Text style={styles.badgeText}>{isSms ? 'SMS' : 'NOTIF'}</Text>
                    </View>
                  </View>
                  <Text style={styles.presetText} numberOfLines={1}>{preset.text}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.fireBtn, isFiring && styles.fireBtnBusy]}
                  onPress={() => handleFire(preset.label, preset.text, preset.pkg)}
                  disabled={isFiring}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.fireBtnText}>{isFiring ? '…' : '🔔'}</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.parseCard}>
                  <Text style={styles.rawLabel}>RAW</Text>
                  <Text style={styles.rawText}>{preset.text}</Text>
                  <View style={styles.divider} />
                  {parseResult !== null ? (
                    <>
                      <Text style={styles.parsedOkLabel}>PARSED ✓</Text>
                      <Text style={styles.parsedMain}>
                        {formatAmount(parseResult!.amountPaise)}
                        {' · '}{parseResult!.events[0]?.type ?? '—'}
                        {' · '}{parseResult!.events[0]?.merchantName ?? '(no merchant)'}
                      </Text>
                      <Text style={styles.parsedMeta}>
                        Trust: {parseResult!.trustLevel} · {parseResult!.templateId ?? 'FSM fallback'}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.parseFailed}>PARSE FAILED ✗ — no financial event detected</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

function formatAmount(paise: number): string {
  const sign = paise < 0 ? '+' : '-';
  const abs = Math.abs(paise) / 100;
  return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  backButton: { width: 72 },
  backText: { color: '#6b7280', fontSize: 14 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { width: 72 },
  headerTitle: { color: '#f3f4f6', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#4b5563', fontSize: 11, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  presetLeft: { flex: 1 },
  presetLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  presetLabel: { color: '#e5e7eb', fontSize: 14, fontWeight: '700' },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  badgeSms: { backgroundColor: '#1e3a5f' },
  badgeNotif: { backgroundColor: '#2d1b4e' },
  badgeText: { color: '#93c5fd', fontSize: 9, fontWeight: '700' },
  presetText: { color: '#6b7280', fontSize: 12, fontFamily: 'monospace' },
  fireBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#3b3b6e',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  fireBtnBusy: { opacity: 0.4 },
  fireBtnText: { fontSize: 18 },
  parseCard: {
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginBottom: 2,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  rawLabel: { color: '#4b5563', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  rawText: { color: '#6b7280', fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
  divider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 8 },
  parsedOkLabel: { color: '#16a34a', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  parsedMain: { color: '#d1fae5', fontSize: 13, fontWeight: '600' },
  parsedMeta: { color: '#4b5563', fontSize: 11, marginTop: 3 },
  parseFailed: { color: '#ef4444', fontSize: 12, fontStyle: 'italic' },
});
