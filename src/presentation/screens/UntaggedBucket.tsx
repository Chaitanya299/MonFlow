import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert
} from 'react-native';
import { NativeAccountingRepository } from '../../domain/accounting/NativeAccountingRepository';
import { ProcessedTransaction, TransactionCategory } from '../../domain/accounting/types';
import { TransactionItem } from '../components/TransactionItem';
import { CategoryPicker } from '../components/CategoryPicker';

const repository = new NativeAccountingRepository();

interface Props {
  onBack: () => void;
}

export const UntaggedBucket: React.FC<Props> = ({ onBack }) => {
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<ProcessedTransaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUntagged();
  }, []);

  const fetchUntagged = async () => {
    try {
      const data = await repository.getUntagged();
      setTransactions(data);
    } catch (e) {
      console.error('Failed to fetch untagged:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = async (category: TransactionCategory) => {
    if (!selectedTx) return;

    try {
      await repository.updateCategory(selectedTx.id, category);
      // Remove from local list as it's now tagged
      setTransactions(prev => prev.filter(t => t.id !== selectedTx.id));
      setSelectedTx(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to update category. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reconcile</Text>
        <Text style={styles.count}>{transactions.length} items</Text>
      </View>

      <View style={styles.instructionBox}>
        <Text style={styles.instruction}>
          Tap a transaction to categorize it and move it to your vault.
        </Text>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedTx(item)}
            style={[selectedTx?.id === item.id && styles.selectedItem]}
          >
            <TransactionItem transaction={item} />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>Everything has been categorized.</Text>
          </View>
        }
      />

      {selectedTx && (
        <View style={styles.pickerContainer}>
          <CategoryPicker
            onSelect={handleCategorySelect}
            selectedCategory={selectedTx.category}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setSelectedTx(null)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  count: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '600',
  },
  instructionBox: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    margin: 24,
    borderRadius: 8,
  },
  instruction: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  selectedItem: {
    backgroundColor: '#fafafa',
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  pickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d32f2f',
    letterSpacing: 1,
  },
});
