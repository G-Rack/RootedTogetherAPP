import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import PasswordInput from '../components/PasswordInput';

// For returning users who already created an account during sign-up.
export default function LoginScreen({ onBack, onLoggedIn, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError('Enter your email and password to log in.');
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
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
    <View>
      <Text style={styles.h1}>Log in</Text>
      <Text style={styles.sub}>Welcome back — enter the email and password you signed up with.</Text>

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

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <PasswordInput value={password} onChangeText={setPassword} />
        <TouchableOpacity onPress={onForgotPassword} style={styles.forgotLink} disabled={submitting}>
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nav}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onBack} disabled={submitting}>
          <Text style={styles.ghostBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={handleLogin} disabled={submitting}>
          <Text style={styles.btnText}>{submitting ? 'Logging in…' : 'Log in'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 24, color: colors.brown, marginBottom: 6, fontWeight: '700' },
  sub: { fontSize: 14.5, color: colors.textSoft, marginBottom: 22 },
  field: { marginBottom: 20 },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.brown, marginBottom: 6 },
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
  forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
  forgotLinkText: { color: colors.brownLight, fontSize: 13.5, fontWeight: '600' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  btn: { backgroundColor: colors.brown, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 999 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  ghostBtnText: { color: colors.brown, fontSize: 15, fontWeight: '600' },
});
