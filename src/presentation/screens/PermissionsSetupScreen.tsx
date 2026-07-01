import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Linking,
  AppState,
  AppStateStatus,
  NativeModules,
  Platform,
} from 'react-native';

const { MonfloBridge } = NativeModules;

interface Props {
  onDone: () => void;
}

interface PermissionState {
  notificationListener: boolean;
  sms: boolean;
  batteryExempt: boolean;
}

export const PermissionsSetupScreen: React.FC<Props> = ({ onDone }) => {
  const [perms, setPerms] = useState<PermissionState>({
    notificationListener: false,
    sms: false,
    batteryExempt: false,
  });
  const appState = useRef(AppState.currentState);

  const checkAll = async () => {
    const [nlEnabled, smsResult, batteryExempt] = await Promise.all([
      MonfloBridge?.isNotificationListenerEnabled() ?? Promise.resolve(false),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      MonfloBridge?.isIgnoringBatteryOptimizations() ?? Promise.resolve(true),
    ]);
    setPerms({ notificationListener: nlEnabled, sms: smsResult, batteryExempt });
  };

  useEffect(() => {
    checkAll();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkAll();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, []);

  const requestSms = async () => {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ]);
    const granted =
      results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    setPerms(prev => ({ ...prev, sms: granted }));
  };

  const openNotificationSettings = async () => {
    // Deep-link to the Notification Access toggle. Falls back to the app's
    // settings page only if the native intent is unavailable.
    try {
      await MonfloBridge?.openNotificationListenerSettings();
    } catch {
      Linking.openSettings();
    }
  };

  const requestBatteryExemption = async () => {
    try {
      await MonfloBridge?.requestIgnoreBatteryOptimizations();
    } catch {
      Linking.openSettings();
    }
  };

  const allGranted = perms.notificationListener && perms.sms && perms.batteryExempt;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setup Required</Text>
      <Text style={styles.subtitle}>
        Monflo needs two permissions to capture bank transactions automatically.
      </Text>

      <PermissionRow
        label="Notification Access"
        description="Captures UPI and bank app alerts"
        granted={perms.notificationListener}
        onPress={openNotificationSettings}
        actionLabel="Open Settings"
      />

      <PermissionRow
        label="SMS Access"
        description="Captures bank SMS alerts"
        granted={perms.sms}
        onPress={requestSms}
        actionLabel="Grant"
      />

      <PermissionRow
        label="Unrestricted Battery"
        description="Stops Android from killing capture in the background"
        granted={perms.batteryExempt}
        onPress={requestBatteryExemption}
        actionLabel="Allow"
      />

      <TouchableOpacity
        style={[styles.continueButton, !allGranted && styles.continueDisabled]}
        onPress={allGranted ? onDone : checkAll}
        activeOpacity={allGranted ? 0.8 : 1}
      >
        <Text style={styles.continueText}>
          {allGranted ? 'Continue' : 'Waiting for permissions...'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

interface RowProps {
  label: string;
  description: string;
  granted: boolean;
  onPress: () => void;
  actionLabel: string;
}

const PermissionRow: React.FC<RowProps> = ({ label, description, granted, onPress, actionLabel }) => (
  <View style={styles.row}>
    <View style={styles.rowInfo}>
      <Text style={[styles.statusDot, granted ? styles.dotGranted : styles.dotMissing]}>
        {granted ? '●' : '○'}
      </Text>
      <View>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
    </View>
    {!granted && (
      <TouchableOpacity style={styles.actionButton} onPress={onPress}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
    {granted && <Text style={styles.grantedText}>Granted</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#555555',
    lineHeight: 22,
    marginBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    fontSize: 18,
    marginRight: 14,
  },
  dotGranted: {
    color: '#2E7D32',
  },
  dotMissing: {
    color: '#CCCCCC',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  rowDesc: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  grantedText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 48,
  },
  continueDisabled: {
    backgroundColor: '#CCCCCC',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
