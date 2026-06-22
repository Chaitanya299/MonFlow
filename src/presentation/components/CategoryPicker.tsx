import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { TransactionCategory } from '../../domain/accounting/types';

interface Props {
  onSelect: (category: TransactionCategory) => void;
  selectedCategory?: TransactionCategory;
}

const CATEGORIES: { id: TransactionCategory; label: string; icon: string }[] = [
  { id: 'food', label: 'Food', icon: '🍔' },
  { id: 'transport', label: 'Transport', icon: '🚗' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'bills', label: 'Bills', icon: '📄' },
  { id: 'entertainment', label: 'Fun', icon: '🎮' },
  { id: 'health', label: 'Health', icon: '💊' },
  { id: 'transfer', label: 'Transfer', icon: '💸' },
  { id: 'untagged', label: 'Reset', icon: '❓' },
];

export const CategoryPicker: React.FC<Props> = ({ onSelect, selectedCategory }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.item,
              selectedCategory === cat.id && styles.selectedItem
            ]}
            onPress={() => onSelect(cat.id)}
          >
            <Text style={styles.icon}>{cat.icon}</Text>
            <Text style={[
              styles.itemLabel,
              selectedCategory === cat.id && styles.selectedLabel
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 12,
    marginLeft: 24,
    letterSpacing: 1,
  },
  scroll: {
    paddingLeft: 24,
    paddingRight: 12,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    marginRight: 12,
  },
  selectedItem: {
    backgroundColor: '#1a1a1a',
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  selectedLabel: {
    color: '#fff',
  },
});
