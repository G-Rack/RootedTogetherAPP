import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, serif } from '../theme';

// A small "Edit" sheet: the current words in a box, Save and Cancel.
// onSave(newText) may throw; the sheet then shows an error and stays open.
export default function EditTextSheet({ visible, title = 'Edit', initial = '', maxLength = 2000, allowEmpty = false, onSave, onClose }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) { setText(initial); setError(null); setBusy(false); }
  }, [visible, initial]);

  async function save() {
    const next = text.trim();
    if (!allowEmpty && !next) { setError('Please write something first.'); return; }
    if (next === (initial || '').trim()) { onClose(); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError('Couldn’t save your changes. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            maxLength={maxLength}
            textAlignVertical="top"
            placeholderTextColor={colors.textSoft}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,33,24,0.45)' },
  backdropTap: { flex: 1 },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28 },
  title: { fontFamily: serif, fontSize: 19, color: colors.brown, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 12, padding: 12, minHeight: 120, maxHeight: 240,
    fontSize: 15.5, color: colors.text, lineHeight: 22,
  },
  error: { color: colors.errorText, fontSize: 13.5, marginTop: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  cancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  cancelText: { fontSize: 15, color: colors.brown, fontWeight: '700' },
  save: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 999, backgroundColor: colors.brown, overflow: 'visible' },
  saveText: { fontSize: 15, color: colors.white, fontWeight: '700' },
});
