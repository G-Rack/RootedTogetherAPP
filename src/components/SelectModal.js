import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, serif } from '../theme';

// A brand-styled dropdown replacement. Pure JS/RN, no native picker module —
// keeps this app runnable in plain Expo Go with zero native-module version risk.
export default function SelectModal({ visible, title, options, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, item === value && styles.rowActive]}
                onPress={() => onSelect(item)}
              >
                <Text style={[styles.rowText, item === value && styles.rowTextActive]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(43,33,24,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32 },
  title: { fontFamily: serif, fontSize: 17, color: colors.brown, marginBottom: 10, fontWeight: '700' },
  row: { paddingVertical: 14, paddingHorizontal: 10, borderRadius: 10 },
  rowActive: { backgroundColor: colors.creamDark },
  rowText: { fontSize: 15.5, color: colors.text },
  rowTextActive: { color: colors.brown, fontWeight: '700' },
  cancel: { marginTop: 8, alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: colors.textSoft, fontSize: 14.5 },
});
