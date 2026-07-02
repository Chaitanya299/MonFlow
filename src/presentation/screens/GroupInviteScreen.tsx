import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert
} from 'react-native';
import { InvitePayload, base64ToBytes } from '../../domain/social/InviteManager';
import { AutomergeSyncEngine } from '../../domain/social/AutomergeSyncEngine';
import { WakuProvider } from '../../domain/social/network/WakuProvider';
import { RelayClient } from '../../domain/social/network/RelayClient';
import { FailoverManager } from '../../domain/social/network/FailoverManager';

// Initialize network stack for join (Simplified for prototype)
const waku = new WakuProvider();
const relay = new RelayClient();
const network = new FailoverManager(waku, relay);
const syncEngine = new AutomergeSyncEngine(network);

interface Props {
  payload: InvitePayload;
  onDone: () => void;
  onCancel: () => void;
}

export const GroupInviteScreen: React.FC<Props> = ({ payload, onDone, onCancel }) => {
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      // The group's real E2EE secret travels in the invite link (already
      // validated as 32 bytes by InviteManager.parseInviteLink).
      const sharedSecret = base64ToBytes(payload.sharedSecret);

      await syncEngine.joinGroupFromInvite(payload.groupId, sharedSecret);

      Alert.alert(
        'Joined!',
        `You have successfully joined the group from ${payload.creatorName}.`,
        [{ text: 'OK', onPress: onDone }]
      );
    } catch (e) {
      console.error('Failed to join group:', e);
      Alert.alert('Error', 'Failed to join group. The link might be invalid.');
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>INVITATION</Text>
        <Text style={styles.title}>Join Split Group</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            <Text style={styles.bold}>{payload.creatorName}</Text> invited you to split expenses.
          </Text>
          <Text style={styles.subInfo}>
            Group ID: {payload.groupId.substring(0, 8)}...
          </Text>
        </View>

        <View style={styles.securityBadge}>
          <Text style={styles.badgeText}>🔒 End-to-End Encrypted</Text>
        </View>

        <View style={styles.actions}>
          {joining ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
                <Text style={styles.joinText}>Accept Invitation</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelText}>Not Now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Text style={styles.footer}>
        Monflo never sees your financial data or group details.
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 32,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
  },
  subInfo: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  securityBadge: {
    alignSelf: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 40,
  },
  badgeText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  joinButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  }
});
