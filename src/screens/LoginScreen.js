import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../supabaseClient';
import {
  AuthShell, BrandHeader, PillInput, PrimaryButton, ErrorNote, SocialButtons, DARK,
} from '../components/DarkUI';
import { signInWithApple, signInWithGoogle } from '../socialAuth';

// For returning users who already created an account during sign-up.
// Same dark look as the sign-up screens.
export default function LoginScreen({ onBack, onLoggedIn, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);

  async function handleSocial(which) {
    if (socialBusy || submitting) return;
    setError(null);
    setSocialBusy(true);
    const res = which === 'apple' ? await signInWithApple() : await signInWithGoogle();
    setSocialBusy(false);
    if (res.error) setError(res.error);
    else if (res.ok) onLoggedIn?.();
  }

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password to log in.');
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (signInError) {
      if (/confirm/i.test(signInError.message || '')) {
        setError('Please confirm your email first — check your inbox for the link we sent when you signed up.');
      } else {
        setError('That email and password don’t match an account we have.');
      }
      return;
    }
    onLoggedIn?.();
  }

  return (
    <AuthShell>
      <BrandHeader tagline="Welcome back. Log in to pick up where you left off." />

      <SocialButtons
        busy={socialBusy || submitting}
        onApple={() => handleSocial('apple')}
        onGoogle={() => handleSocial('google')}
      />

      <PillInput
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="Email address"
        keyboardType="email-address"
        textContentType="username"
        accessibilityLabel="Email"
      />
      <PillInput
        icon="lock-closed-outline"
        secure
        style={{ marginTop: 10 }}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        // Same iOS autofill workaround as PasswordInput.js.
        textContentType="oneTimeCode"
        accessibilityLabel="Password"
      />

      <TouchableOpacity onPress={onForgotPassword} disabled={submitting} style={styles.forgot} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 16 }}>
        <ErrorNote message={error} />
        <PrimaryButton label="Log in" variant="gold" busy={submitting} onPress={handleLogin} />
      </View>

      <View style={{ flex: 1, minHeight: 24 }} />
      <TouchableOpacity onPress={onBack} disabled={submitting} style={styles.switchRow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.switchText}>New here? <Text style={styles.switchLink}>Create account</Text></Text>
      </TouchableOpacity>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: 14 },
  forgotText: { color: DARK.gold, fontSize: 14, fontWeight: '600' },
  switchRow: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 15, color: DARK.soft },
  switchLink: { color: DARK.text, fontWeight: '700', textDecorationLine: 'underline' },
});
