import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProcessedTransaction } from '../../domain/accounting/types';

interface Props {
  transaction: ProcessedTransaction;
}

export const TransactionItem: React.FC<Props> = ({ transaction }) => {
  const isExpense = transaction.amountPaise > 0;
  const displayAmount = (Math.abs(transaction.amountPaise) / 100).toFixed(2);
  const date = new Date(transaction.timestamp).toLocaleDateString();

  return (
    <View style={styles.container}>
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
    </View>
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
