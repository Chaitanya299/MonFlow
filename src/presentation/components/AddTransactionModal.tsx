import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { TransactionCategory, ProcessedTransaction } from '../../domain/accounting/types';
import { buildManualTransaction, ManualSource } from '../../domain/accounting/ManualEntry';
import { NativeAccountingRepository } from '../../domain/accounting/NativeAccountingRepository';
import { CategoryPicker } from './CategoryPicker';

const repository = new NativeAccountingRepository();

export interface AddTxnConfig {
  title: string;
  sourcePackage: ManualSource;
  outLabel: string; // money-out direction (spend / expense)
  inLabel: string; // money-in direction (top-up / income)
}

interface Props {
  config: AddTxnConfig;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editTx?: ProcessedTransaction; // when set, pre-fill + replace this row on save
}

export const AddTransactionModal: React.FC<Props> = ({ config, visible, onClose, onSaved, editTx }) => {
  const [amount, setAmount] = useState(editTx ? (Math.abs(editTx.amountPaise) / 100).toString() : '');
  const [direction, setDirection] = useState<'out' | 'in'>(editTx && editTx.amountPaise < 0 ? 'in' : 'out');
  const [category, setCategory] = useState<TransactionCategory>(editTx?.category ?? 'untagged');
  const [note, setNote] = useState(editTx?.merchantName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setAmount(''); setDirection('out'); setCategory('untagged'); setNote(''); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const tx = buildManualTransaction({
        amountRupees: amount,
        direction,
        // income/top-up has no spend category
        category: direction === 'in' ? 'transfer' : category,
        note,
        sourcePackage: (editTx?.sourcePackage as ManualSource) ?? config.sourcePackage,
        id: editTx?.id, // replaces the existing row when editing
        timestamp: editTx?.timestamp, // keep original time on edit
      });
      await repository.save(tx);
      reset();
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{editTx ? 'Edit' : config.title}</Text>
            <TouchableOpacity onPress={close}><Text style={styles.closeX}>✕</Text></TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggle, direction === 'out' && styles.toggleActive]}
              onPress={() => setDirection('out')}
            >
              <Text style={[styles.toggleText, direction === 'out' && styles.toggleTextActive]}>{config.outLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggle, direction === 'in' && styles.toggleActive]}
              onPress={() => setDirection('in')}
            >
              <Text style={[styles.toggleText, direction === 'in' && styles.toggleTextActive]}>{config.inLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#ccc"
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Note (optional)"
            placeholderTextColor="#aaa"
            maxLength={80}
          />

          {direction === 'out' && (
            <CategoryPicker selectedCategory={category} onSelect={setCategory} />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveDisabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  closeX: { fontSize: 20, color: '#888', padding: 4 },
  toggleRow: { flexDirection: 'row', marginHorizontal: 24, backgroundColor: '#f2f2f2', borderRadius: 12, padding: 4, marginBottom: 24 },
  toggle: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleActive: { backgroundColor: '#1a1a1a' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#666' },
  toggleTextActive: { color: '#fff' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  rupee: { fontSize: 32, fontWeight: '700', color: '#1a1a1a', marginRight: 4 },
  amountInput: { fontSize: 40, fontWeight: '700', color: '#1a1a1a', minWidth: 120, textAlign: 'center', padding: 0 },
  noteInput: { marginHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 10, fontSize: 15, color: '#1a1a1a' },
  error: { color: '#d32f2f', fontSize: 13, textAlign: 'center', marginTop: 12, marginHorizontal: 24 },
  saveButton: { backgroundColor: '#000', marginHorizontal: 24, marginTop: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
