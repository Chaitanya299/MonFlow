import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ProcessedTransaction } from '../../domain/accounting/types';

interface Props {
  transaction: ProcessedTransaction;
  onEdit?: (tx: ProcessedTransaction) => void;
  onDelete?: (tx: ProcessedTransaction) => void;
}

export const TransactionItem: React.FC<Props> = ({ transaction, onEdit, onDelete }) => {
  const isExpense = transaction.amountPaise > 0;
  const displayAmount = (Math.abs(transaction.amountPaise) / 100).toFixed(2);
  const date = new Date(transaction.timestamp).toLocaleDateString();
  const isManual = transaction.sourcePackage === 'cash' || transaction.sourcePackage === 'manual';

  const onLongPress = () => {
    if (!onEdit && !onDelete) return;
    const buttons: any[] = [];
    if (onEdit && isManual) buttons.push({ text: 'Edit', onPress: () => onEdit(transaction) });
    if (onDelete) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete transaction?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(transaction) },
          ]),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(transaction.merchantName || 'Transaction', undefined, buttons);
  };

  return (
    <TouchableOpacity style={styles.container} onLongPress={onLongPress} delayLongPress={300} activeOpacity={0.6}>
      <View style={styles.left}>
        <Text style={styles.merchant}>{transaction.merchantName || 'Unknown Merchant'}</Text>
        <Text style={styles.details}>{transaction.sourcePackage.split('.').pop()?.toUpperCase()} • {date}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, isExpense ? styles.expense : styles.income]}>
          {isExpense ? '-' : '+'} ₹{displayAmount}
        </Text>
        <Text style={styles.category}>{transaction.category.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  left: {
    flex: 1,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  details: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  expense: {
    color: '#d32f2f', // Actionable Red
  },
  income: {
    color: '#388e3c', // Actionable Green
  },
  category: {
    fontSize: 10,
    color: '#aaaaaa',
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
