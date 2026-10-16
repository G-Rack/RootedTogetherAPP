import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, serif } from '../theme';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY_LETTERS = ['S','M','T','W','T','F','S'];

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// A real month-grid calendar, built from plain RN Views/TouchableOpacity —
// no native date-picker module, so it can't crash from an Expo Go /
// native-binary version mismatch. Value in/out is an ISO string
// ("YYYY-MM-DD"), which is what Airtable's Date field type expects.
export default function CalendarPickerModal({ visible, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const initial = value ? new Date(value + 'T00:00:00') : new Date(today.getFullYear() - 25, today.getMonth(), 1);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const selected = value ? value : null;

  function isFuture(y, m, d) {
    const dt = new Date(y, m, d);
    return dt > today;
  }

  function goMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(day) {
    if (!day || isFuture(viewYear, viewMonth, day)) return;
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onSelect(`${viewYear}-${mm}-${dd}`);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => goMonth(-1)} style={styles.navBtn}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewYear((y) => y - 1)} style={styles.yearBtn}>
              <Text style={styles.headerText}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goMonth(1)} style={styles.navBtn}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.yearRow}>
            <TouchableOpacity onPress={() => setViewYear((y) => y - 1)}><Text style={styles.yearJump}>‹ {viewYear - 1}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setViewYear((y) => y + 1)} disabled={viewYear + 1 > today.getFullYear()}>
              <Text style={[styles.yearJump, viewYear + 1 > today.getFullYear() && styles.yearJumpDisabled]}>{viewYear + 1} ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LETTERS.map((w, i) => (
              <Text key={i} style={styles.weekLetter}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = iso === selected;
              const disabled = isFuture(viewYear, viewMonth, day);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => pick(day)}
                  disabled={disabled}
                >
                  <Text style={[styles.cellText, isSelected && styles.cellTextSelected, disabled && styles.cellTextDisabled]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  navBtn: { padding: 8 },
  navText: { fontSize: 22, color: colors.brown },
  yearBtn: { flex: 1, alignItems: 'center' },
  headerText: { fontFamily: serif, fontSize: 17, fontWeight: '700', color: colors.brown },
  yearRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  yearJump: { fontSize: 12.5, color: colors.textSoft },
  yearJumpDisabled: { opacity: 0.3 },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLetter: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textSoft, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: colors.brown, borderRadius: 999 },
  cellText: { fontSize: 14.5, color: colors.text },
  cellTextSelected: { color: colors.white, fontWeight: '700' },
  cellTextDisabled: { color: colors.brownPale },
  cancel: { marginTop: 8, alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: colors.textSoft, fontSize: 14.5 },
});
