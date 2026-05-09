import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { runHandshake } from '../domain/tracking/AlertHandshake';

const App = () => {
  useEffect(() => {
    // Trigger the magic handshake on app launch
    runHandshake();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Monflo</Text>
        <Text style={styles.subtitle}>Privacy-First Expense Tracker</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.status}>Vault is Active</Text>
        <Text style={styles.info}>Tracking UPI notifications locally.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    marginTop: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  status: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2e7d32',
  },
  info: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
  },
});

export default App;
