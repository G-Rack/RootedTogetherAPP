import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import PasswordInput from '../components/PasswordInput';

// The real "Change Password" screen — replaces the "coming in a later
// part of the build" stub. This is a pure Supabase Auth operation
// (auth.updateUser), which has nothing to do with which role table
// someone signed up into — it works identically for a Seeker, Assistant,
// Mother, Pastor, or Spiritual Leader, since every one of them has a real
// row in auth.users from sign-up (see submit-signup's auth.admin.createUser
// call). No Edge Function or role-specific branching is needed here, the
// same way none was needed for Forgot Password (see ForgotPasswordScreen,
// which calls this same auth.updateUser after verifying a reset code).
//
// Unlike Forgot Password, the person is already signed in here, so there's
// no code to verify — instead, this asks for their CURRENT password first
// and re-authenticates with it (a plain signInWithPassword) before calling
// updateUser. That's a deliberate safety check: Supabase's updateUser will
// happily change the password for whatever session is active with no
// extra proof, which would otherwise mean anyone who got hold of an
// unlocked, signed-in phone could lock the real owner out.
export default function ChangePasswordScreen({ session, onBack }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const email = session?.user?.email;

  async function handleSave() {
    setError(null);
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Your new password needs to be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Those new passwords don’t match.');
      return;
    }
    if (!email) {
      setError('Couldn’t verify your account — please log out and back in, then try again.');
      return;
    }

    setSaving(true);
    try {
      // Re-authenticate with the current password first — this is the
      // only thing standing between an unlocked device and a silent
      // password change, since an active session alone is normally
      // enough for Supabase's updateUser to succeed.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setError('Your current password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message || 'Couldn’t update your password right now. Please try again.');
        return;
      }

      Alert.alert('Password updated', 'Your password has been changed.');
      onBack();
    } catch (e) {
      setError(e.message || 'Couldn’t update your password right now. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Change Password</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.wrap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Current password</Text>
          <PasswordInput value={currentPassword} onChangeText={setCurrentPassword} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New password</Text>
          <PasswordInput value={newPassword} onChangeText={setNewPassword} />
          <Text style={styles.hint}>At least 8 characters.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm new password</Text>
          <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => { Keyboard.dismiss(); handleSave(); }}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Update Password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32, alignItems: 'flex-end' },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },

  field: { marginBottom: 20 },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.brown, marginBottom: 6 },
  hint: { fontSize: 12.5, color: colors.textSoft, marginTop: 4 },

  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },

  saveBtn: {
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
