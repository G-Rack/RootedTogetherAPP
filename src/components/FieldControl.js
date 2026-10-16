import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import SelectModal from './SelectModal';
import CalendarPickerModal from './CalendarPickerModal';
import ImagePickerField from './ImagePickerField';
import CertificationUploadField from './CertificationUploadField';
import PasswordInput from './PasswordInput';
import { formatDateHuman } from '../utils/date';
import { colors, serif } from '../theme';

// Renders the right control for a field definition (from src/flows.js) and
// reports changes back up via onChange(name, value). `value` for a
// multiselect field is always an array; for a date field it's an ISO
// "YYYY-MM-DD" string; for an image field it's { uri, base64, fileName,
// mimeType } or null; for everything else, a plain string.
export default function FieldControl({ field, value, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}</Text>

      {field.type === 'text' && (
        <TextInput
          style={styles.input}
          value={value || ''}
          onChangeText={(t) => onChange(field.name, t)}
          placeholder=""
          placeholderTextColor={colors.textSoft}
          // "name" for the actual full-name field, "none" for everything
          // else — these were never the real source of the stray yellow
          // highlight some people saw on fields like Nickname or Full
          // name; that came from the password field elsewhere on the
          // same step (see PasswordInput.js for the actual fix).
          textContentType={field.name === 'Name' ? 'name' : 'none'}
        />
      )}

      {field.type === 'email' && (
        <TextInput
          style={styles.input}
          value={value || ''}
          onChangeText={(t) => onChange(field.name, t)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          // Lets iOS offer previously-used emails from its own history —
          // harmless on its own. (It's the password field, not this one,
          // that can trigger the yellow-highlight bug — see PasswordInput.js.)
          textContentType="username"
        />
      )}

      {field.type === 'password' && (
        <PasswordInput value={value || ''} onChangeText={(t) => onChange(field.name, t)} />
      )}

      {field.type === 'number' && (
        <TextInput
          style={styles.input}
          value={value || ''}
          onChangeText={(t) => onChange(field.name, t.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder=""
          placeholderTextColor={colors.textSoft}
          textContentType="none"
          maxLength={2}
        />
      )}

      {field.type === 'date' && (
        <>
          <TouchableOpacity style={styles.selectBtn} onPress={() => { Keyboard.dismiss(); setDateOpen(true); }}>
            <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
              {value ? formatDateHuman(value) : 'Select a date…'}
            </Text>
            <Text style={styles.chevron}>📅</Text>
          </TouchableOpacity>
          <CalendarPickerModal
            visible={dateOpen}
            value={value}
            onSelect={(iso) => { onChange(field.name, iso); setDateOpen(false); }}
            onClose={() => setDateOpen(false)}
          />
        </>
      )}

      {field.type === 'image' && (
        <ImagePickerField value={value} onChange={(v) => onChange(field.name, v)} />
      )}

      {field.type === 'file' && (
        <CertificationUploadField value={value} onChange={(v) => onChange(field.name, v)} />
      )}

      {/* Single-select bubble/pill row — e.g. the higher-education gate and
          "Highest level of education". Same value shape as `select`
          (a plain string), just rendered as pills instead of a modal. */}
      {field.type === 'pillselect' && (
        <View style={styles.pillRow}>
          {field.options.map((opt) => {
            const chosen = value === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.pill, chosen && styles.pillSelected]}
                onPress={() => onChange(field.name, opt)}
              >
                <Text style={[styles.pillText, chosen && styles.pillTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Multi-select bubble/pill row — every multi-answer field in the app
          (support needs, spiritual gifts, licenses, specialties, etc.)
          renders this way now, matching the sign-up redesign. `multiselect`
          and `pillmultiselect` are the same control; the two names are kept
          only so flows.js can still say which fields are multi-answer. */}
      {(field.type === 'multiselect' || field.type === 'pillmultiselect') && (
        <View style={styles.pillRow}>
          {field.options.map((opt) => {
            const chosen = Array.isArray(value) && value.includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.pill, chosen && styles.pillSelected]}
                onPress={() => {
                  const cur = Array.isArray(value) ? value : [];
                  const next = chosen ? cur.filter((o) => o !== opt) : [...cur, opt];
                  onChange(field.name, next);
                }}
              >
                <Text style={[styles.pillText, chosen && styles.pillTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {field.type === 'textarea' && (
        <TextInput
          style={[styles.input, styles.textarea]}
          value={value || ''}
          onChangeText={(t) => onChange(field.name, t)}
          multiline
          textAlignVertical="top"
          textContentType="none"
        />
      )}

      {field.type === 'select' && (
        <>
          <TouchableOpacity style={styles.selectBtn} onPress={() => { Keyboard.dismiss(); setPickerOpen(true); }}>
            <Text style={value ? styles.selectValue : styles.selectPlaceholder}>
              {value || 'Select…'}
            </Text>
            <Text style={styles.chevron}>⌄</Text>
          </TouchableOpacity>
          <SelectModal
            visible={pickerOpen}
            title={field.label}
            options={field.options}
            value={value}
            onSelect={(v) => { onChange(field.name, v); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        </>
      )}

      {field.hint ? <Text style={styles.hint}>{field.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 20 },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.brown, marginBottom: 6 },
  hint: { fontSize: 12.5, color: colors.textSoft, marginTop: 4 },
  input: {
    fontSize: 15,
    padding: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.25)',
    backgroundColor: colors.white,
    color: colors.text,
  },
  textarea: { minHeight: 90 },
  selectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.25)',
    backgroundColor: colors.white,
  },
  selectValue: { fontSize: 15, color: colors.text },
  selectPlaceholder: { fontSize: 15, color: colors.textSoft },
  chevron: { fontSize: 16, color: colors.brownLight },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.brownPale,
    backgroundColor: colors.white,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillSelected: { backgroundColor: colors.brown, borderColor: colors.brown },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.text },
  pillTextSelected: { color: colors.white },
});
