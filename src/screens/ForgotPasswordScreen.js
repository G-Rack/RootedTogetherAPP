import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import PasswordInput from '../components/PasswordInput';

// Two steps: request a reset code by email, then enter that code alongside
// a new password. This uses Supabase's email-OTP recovery flow rather than
// a link, because a link would need to open back up inside this native app
// (deep linking) — a code the person types in themselves needs none of
// that. Note for whoever configures the Supabase project: the "Reset
// Password" email template needs its {{ .Token }} variable visible in the
// email body (it's not shown by default — only the link is) for the code
// step below to actually reach anyone.
export default function ForgotPasswordScreen({ onBack }) {
  const [step, setStep] = useState('request'); // 'request' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleRequestCode() {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setSubmitting(false);
    if (resetError) {
      setError('Something went wrong sending that code. Please try again in a moment.');
      return;
    }
    setStep('code');
  }

  async function handleResetPassword() {
    setError(null);
    if (!code.trim()) {
      setError('Enter the code we emailed you.');
      return;
    }
    if (password.length < 8) {
      setError('Your new password needs to be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords don’t match.');
      return;
    }
    setSubmitting(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) {
      setSubmitting(false);
      setError('That code didn’t work — it may be wrong or expired. Please try again.');
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError('Your code checked out, but we couldn’t set the new password. Please try again.');
      return;
    }
    // Success: the recovery code just created a real session, and the
    // password is now updated — App.js's session listener picks this up
    // on its own and moves on to the signed-in Home screen from here.
  }

  return (
    <View>
      <Text style={styles.h1}>Reset your password</Text>

      {step === 'request' ? (
        <>
          <Text style={styles.sub}>Enter the email you signed up with — we’ll send you a code to reset your password.</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
            />
          </View>

          <View style={styles.nav}>
            <TouchableOpacity style={styles.ghostBtn} onPress={onBack} disabled={submitting}>
              <Text style={styles.ghostBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={handleRequestCode} disabled={submitting}>
              <Text style={styles.btnText}>{submitting ? 'Sending…' : 'Send code'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={styles.successBox}>
            <Text style={styles.successText}>If an account exists for {email.trim()}, a 6-digit code is on its way. It can take a minute to arrive.</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="oneTimeCode"
              maxLength={6}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>New password</Text>
            <PasswordInput value={password} onChangeText={setPassword} />
            <Text style={styles.hint}>At least 8 characters.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm new password</Text>
            <PasswordInput value={confirmPassword} onChangeText={setConfirmPassword} />
          </View>

          <View style={styles.nav}>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep('request')} disabled={submitting}>
              <Text style={styles.ghostBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={handleResetPassword} disabled={submitting}>
              <Text style={styles.btnText}>{submitting ? 'Saving…' : 'Reset password'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 24, color: colors.brown, marginBottom: 6, fontWeight: '700' },
  sub: { fontSize: 14.5, color: colors.textSoft, marginBottom: 22 },
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
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  successBox: {
    backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  successText: { color: colors.successText, fontSize: 13.5 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  btn: { backgroundColor: colors.brown, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 999 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  ghostBtnText: { color: colors.brown, fontSize: 15, fontWeight: '600' },
});
