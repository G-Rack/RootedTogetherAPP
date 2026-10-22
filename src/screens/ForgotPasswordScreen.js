import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../supabaseClient';
import {
  AuthShell, BrandHeader, PillInput, PrimaryButton, ErrorNote, DARK,
} from '../components/DarkUI';

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
    <AuthShell>
      <BrandHeader tagline={step === 'request'
        ? 'Enter the email you signed up with and we’ll send you a code to reset your password.'
        : 'Enter the code we emailed you, then choose a new password.'}
      />

      {step === 'request' ? (
        <>
          <PillInput
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            keyboardType="email-address"
            textContentType="username"
            accessibilityLabel="Email"
          />
          <View style={{ marginTop: 16 }}>
            <ErrorNote message={error} />
            <PrimaryButton label="Send code" variant="gold" busy={submitting} onPress={handleRequestCode} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.successBox}>
            <Text style={styles.successText}>If an account exists for {email.trim()}, a 6-digit code is on its way. It can take a minute to arrive.</Text>
          </View>

          <PillInput
            icon="keypad-outline"
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            accessibilityLabel="Code"
          />
          <PillInput
            icon="lock-closed-outline"
            secure
            style={{ marginTop: 10 }}
            value={password}
            onChangeText={setPassword}
            placeholder="New password (8+ characters)"
            textContentType="oneTimeCode"
            accessibilityLabel="New password"
          />
          <PillInput
            icon="lock-closed-outline"
            secure
            style={{ marginTop: 10 }}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            textContentType="oneTimeCode"
            accessibilityLabel="Confirm new password"
          />

          <View style={{ marginTop: 16 }}>
            <ErrorNote message={error} />
            <PrimaryButton label="Reset password" variant="gold" busy={submitting} onPress={handleResetPassword} />
          </View>
        </>
      )}

      <View style={{ flex: 1, minHeight: 24 }} />
      <TouchableOpacity
        onPress={step === 'code' ? () => setStep('request') : onBack}
        disabled={submitting}
        style={styles.backRow}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.backText}>{step === 'code' ? 'Use a different email' : 'Back to log in'}</Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  successBox: {
    backgroundColor: 'rgba(232,196,138,0.12)', borderWidth: 1, borderColor: 'rgba(232,196,138,0.3)',
    borderRadius: 16, padding: 14, marginBottom: 14,
  },
  successText: { color: 'rgba(251,246,239,0.9)', fontSize: 13.5, lineHeight: 19 },
  backRow: { alignItems: 'center', paddingVertical: 8 },
  backText: { fontSize: 15, color: DARK.text, fontWeight: '700', textDecorationLine: 'underline' },
});
