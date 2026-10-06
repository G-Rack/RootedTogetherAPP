import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { colors, serif } from '../theme';
import FieldControl from '../components/FieldControl';
import { FLOWS } from '../flows';
import {
  ROLE_TO_FLOW_KEY, fetchMyFullProfileRow, buildFormDataFromRow, saveMyProfileFields, EXCLUDED_FIELD_NAMES,
} from '../profileEditing';

// The real Edit Profile screen — replaces the old "coming in a later part
// of the build" stub on all four call sites in ProfileScreen.js. Reuses
// the exact same `flows.js` FLOWS config (and FieldControl) sign-up
// itself uses, so every question originally asked at sign-up can be
// revisited here — not just the handful of fields directory_listing
// exposes — pre-filled from the person's own role-table row.
//
// Email is shown but read-only (matching the approved design mockup):
// changing a login email isn't wired up anywhere in this app yet, so this
// avoids silently accepting an edit that wouldn't actually do anything.
// Password lives on its own "Change Password" Settings row, Profile
// Picture keeps its existing pencil-badge upload flow, and Certification
// Upload isn't editable here either — certification-documents is a
// private bucket with no client-facing write policy, same reason
// update-profile-picture exists as its own Edge Function.
export default function EditProfileScreen({ session, person, onBack, onSaved }) {
  const [row, setRow] = useState(undefined); // undefined = loading, null = no row found
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const myAuthId = session?.user?.id;
  const role = person?.role;
  const flowKey = ROLE_TO_FLOW_KEY[role];
  const flow = flowKey ? FLOWS[flowKey] : null;

  const load = useCallback(async () => {
    const data = await fetchMyFullProfileRow(myAuthId, role);
    setRow(data);
    setFormData(buildFormDataFromRow(flowKey, data));
  }, [myAuthId, role, flowKey]);

  useEffect(() => {
    load();
  }, [load]);

  function handleChange(name, value) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await saveMyProfileFields(myAuthId, role, flowKey, formData);
      Alert.alert('Saved', 'Your profile has been updated.');
      onSaved();
    } catch (e) {
      setError(e.message || 'Couldn’t save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!flow) {
    return (
      <View style={styles.wrap}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Edit Profile</Text>
          <View style={styles.backBtn} />
        </View>
        <Text style={styles.emptyText}>We couldn’t find your sign-up details to edit.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      {row === undefined ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <ScrollView
          style={styles.wrap}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}
        >
          {row === null ? (
            <View style={styles.hintBanner}>
              <Text style={styles.hintBannerText}>
                We couldn’t find your original sign-up details — anything you fill in and save below will be added to your profile.
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyBox}>
              <Text style={styles.readOnlyText}>{row?.email || '—'}</Text>
            </View>
            <Text style={styles.hint}>Your email is your login — contact support if you need it changed.</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {flow.steps.map((step) => {
            if (step.condition && !step.condition(formData)) return null;
            const fields = step.fields.filter((f) => !EXCLUDED_FIELD_NAMES.has(f.name));
            if (!fields.length) return null;
            return (
              <View key={step.id} style={styles.stepBlock}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                {step.sub ? <Text style={styles.stepSub}>{step.sub}</Text> : null}
                {fields.map((field) => {
                  if (field.condition && !field.condition(formData)) return null;
                  return (
                    <FieldControl
                      key={field.name}
                      field={field}
                      value={formData[field.name]}
                      onChange={handleChange}
                    />
                  );
                })}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => { Keyboard.dismiss(); handleSave(); }}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 40, marginHorizontal: 30 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32, alignItems: 'flex-end' },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },

  hintBanner: {
    backgroundColor: colors.creamDark, borderRadius: 10, padding: 12, marginBottom: 18,
  },
  hintBannerText: { fontSize: 12.5, color: colors.textSoft, lineHeight: 18 },

  field: { marginBottom: 20 },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.brown, marginBottom: 6 },
  hint: { fontSize: 12.5, color: colors.textSoft, marginTop: 4 },
  readOnlyBox: {
    fontSize: 15, padding: 13, borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.15)', backgroundColor: colors.creamDark,
  },
  readOnlyText: { fontSize: 15, color: colors.textSoft },

  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },

  stepBlock: { marginBottom: 10 },
  stepTitle: { fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700', marginBottom: 4 },
  stepSub: { fontSize: 12.5, color: colors.textSoft, marginBottom: 14, lineHeight: 18 },

  saveBtn: {
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
