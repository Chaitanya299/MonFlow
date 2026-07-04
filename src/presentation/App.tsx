import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, NativeModules, PermissionsAndroid } from 'react-native';
import { Dashboard } from './screens/Dashboard';
import { UntaggedBucket } from './screens/UntaggedBucket';
import { GroupInviteScreen } from './screens/GroupInviteScreen';
import { PermissionsSetupScreen } from './screens/PermissionsSetupScreen';
import { DevTestScreen } from './screens/DevTestScreen';
import { LiveMonitorScreen } from './screens/LiveMonitorScreen';
import { NotifSimulatorScreen } from './screens/NotifSimulatorScreen';
import { SecurityManager } from '../domain/tracking/SecurityManager';
import { RuleManager } from '../domain/tracking/RuleManager';
import { InviteManager, InvitePayload } from '../domain/social/InviteManager';

const { MonfloBridge } = NativeModules;

type Screen = 'DASHBOARD' | 'UNTAGGED_BUCKET' | 'GROUP_INVITE' | 'PERMISSIONS_SETUP' | 'DEV_TEST' | 'LIVE_MONITOR' | 'NOTIF_SIMULATOR';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('DASHBOARD');
  const [pendingInvite, setPendingInvite] = useState<InvitePayload | null>(null);

  const initializeApp = async () => {
    try {
      // 0. Ensure the encrypted vault exists BEFORE any DB access. The SQLCipher
      // DB passphrase is derived from Keystore-encrypted entropy; without an
      // initialized vault the stored IV is empty and opening the DB throws
      // "unsupported IV length: 0 bytes". This is idempotent — guarded by
      // isVaultInitialized so it only generates entropy on first launch.
      const vaultReady = await (MonfloBridge?.isVaultInitialized() ?? Promise.resolve(true));
      if (!vaultReady) {
        await MonfloBridge?.initializeVault();
      }

      // 1. Load local rules for parser
      await RuleManager.loadLocalRules();

      // 2. Setup invite listener
      InviteManager.listenForInvites((payload) => {
        setPendingInvite(payload);
        setCurrentScreen('GROUP_INVITE');
      });

      // 3. Check biometric gate
      const authorized = await SecurityManager.checkGate();
      if (!authorized) {
        setError('Authentication failed. Please restart the app.');
        return;
      }
      setIsAuthenticated(true);

      // 4. Check if required permissions are already granted; if not, show setup screen
      const [nlEnabled, smsGranted] = await Promise.all([
        MonfloBridge?.isNotificationListenerEnabled() ?? Promise.resolve(false),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      ]);
      if (!nlEnabled || !smsGranted) {
        setCurrentScreen('PERMISSIONS_SETUP');
      }
    } catch (e) {
      console.error('Initialization error:', e);
      setError('System error during launch.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockedText}>Vault is Locked</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeApp}>
          <Text style={styles.retryText}>Unlock Vault</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render current screen
  switch (currentScreen) {
    case 'PERMISSIONS_SETUP':
      return <PermissionsSetupScreen onDone={() => setCurrentScreen('DASHBOARD')} />;
    case 'GROUP_INVITE':
      return pendingInvite ? (
        <GroupInviteScreen
          payload={pendingInvite}
          onDone={() => {
            setPendingInvite(null);
            setCurrentScreen('DASHBOARD');
          }}
          onCancel={() => {
            setPendingInvite(null);
            setCurrentScreen('DASHBOARD');
          }}
        />
      ) : (
        <Dashboard
          onOpenUntagged={() => setCurrentScreen('UNTAGGED_BUCKET')}
          onOpenDevTest={__DEV__ ? () => setCurrentScreen('DEV_TEST') : undefined}
          onOpenPermissions={() => setCurrentScreen('PERMISSIONS_SETUP')}
        />
      );
    case 'UNTAGGED_BUCKET':
      return <UntaggedBucket onBack={() => setCurrentScreen('DASHBOARD')} />;
    case 'DEV_TEST':
      return (
        <DevTestScreen
          onBack={() => setCurrentScreen('DASHBOARD')}
          onOpenLiveMonitor={() => setCurrentScreen('LIVE_MONITOR')}
          onOpenSimulator={() => setCurrentScreen('NOTIF_SIMULATOR')}
        />
      );
    case 'LIVE_MONITOR':
      return <LiveMonitorScreen onBack={() => setCurrentScreen('DEV_TEST')} />;
    case 'NOTIF_SIMULATOR':
      return <NotifSimulatorScreen onBack={() => setCurrentScreen('DEV_TEST')} />;
    case 'DASHBOARD':
    default:
      return (
        <Dashboard
          onOpenUntagged={() => setCurrentScreen('UNTAGGED_BUCKET')}
          onOpenDevTest={__DEV__ ? () => setCurrentScreen('DEV_TEST') : undefined}
          onOpenPermissions={() => setCurrentScreen('PERMISSIONS_SETUP')}
        />
      );
  }
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  lockedText: {
    color: '#1a1a1a',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default App;
