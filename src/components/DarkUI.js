import React, { useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAwareScrollView from './KeyboardAwareScrollView';
import Ionicons from '@expo/vector-icons/Ionicons';
import { serif } from '../theme';

// Shared pieces of the dark, slide-style sign-up (OnboardingScreen) and the
// welcome screen. Kept in one place so every slide looks identical.

export const DARK = {
  text: '#FBF6EF',
  soft: 'rgba(251,246,239,0.76)',
  faint: 'rgba(251,246,239,0.6)',
  pill: 'rgba(251,246,239,0.08)',
  pillBorder: 'rgba(251,246,239,0.18)',
  pillOn: 'rgba(251,246,239,0.2)',
  gold: '#E8C48A',
  ink: '#2A1A10',
  error: '#FFB4A8',
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const STOPS = [[0, '#2A1A10'], [0.6, '#4B2F1D'], [1, '#5E3B22']];
const BANDS = 48;

function colorAt(t) {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// A top-to-bottom warm-brown gradient built from stacked bands, so it needs
// no extra native package (works in Expo Go and every existing build).
export function Gradient() {
  const colorsList = useMemo(() => Array.from({ length: BANDS }, (_, i) => colorAt(i / (BANDS - 1))), []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {colorsList.map((c, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

// Back arrow, step bar, and an optional Skip.
export function TopBar({ step, total, onBack, onSkip }) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <TouchableOpacity style={styles.topSide} onPress={onBack} accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={DARK.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.topSide} />
      )}
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentOn]} />
        ))}
      </View>
      {onSkip ? (
        <TouchableOpacity style={[styles.topSide, { alignItems: 'flex-end' }]} onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.topSide} />
      )}
    </View>
  );
}

export function Heading({ title, sub }) {
  return (
    <View style={{ marginTop: 22, marginBottom: 20 }}>
      <Text style={styles.h1}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

// Full-width cream pill (Continue) — or gold with variant="gold".
export function PrimaryButton({ label, onPress, busy, disabled, variant }) {
  const gold = variant === 'gold';
  return (
    <TouchableOpacity
      style={[styles.btn, gold && styles.btnGold, (disabled || busy) && { opacity: 0.55 }]}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.85}
    >
      {busy ? <ActivityIndicator color={DARK.ink} /> : <Text style={styles.btnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

// "Continue with Apple" (iPhone only) and "Continue with Google", then an "or"
// divider. Shared by the sign-up and log-in screens.
export function SocialButtons({ onApple, onGoogle, busy }) {
  return (
    <View>
      {Platform.OS === 'ios' ? (
        <TouchableOpacity style={[styles.appleBtn, busy && { opacity: 0.55 }]} onPress={onApple} disabled={busy} activeOpacity={0.85} accessibilityLabel="Continue with Apple">
          <Ionicons name="logo-apple" size={21} color={DARK.ink} />
          <Text style={styles.appleText}>Continue with Apple</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={[styles.googleBtn, busy && { opacity: 0.55 }]} onPress={onGoogle} disabled={busy} activeOpacity={0.85} accessibilityLabel="Continue with Google">
        <Ionicons name="logo-google" size={19} color={DARK.text} />
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>
    </View>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

// Full-screen dark page for sign in / password reset: same gradient, safe
// areas and keyboard handling as the sign-up slides.
export function AuthShell({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.shell}>
      <Gradient />
      <View style={[styles.shellContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={styles.shellScroll} showsVerticalScrollIndicator={false}>
          {children}
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

// Logo, name and a line of text, as at the top of the sign-up screen.
export function BrandHeader({ tagline }) {
  return (
    <View style={styles.brandWrap}>
      <View style={styles.logo}>
        <Ionicons name="leaf-outline" size={34} color={DARK.gold} />
      </View>
      <Text style={styles.brand}>Rooted Together</Text>
      {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}
    </View>
  );
}

// Rounded dark input with a leading icon (and an eye toggle when secure).
export function PillInput({ icon, secure, style, ...rest }) {
  const [show, setShow] = React.useState(false);
  return (
    <View style={[styles.pillInput, style]}>
      {icon ? <Ionicons name={icon} size={20} color={DARK.faint} /> : null}
      <TextInput
        style={styles.pillInner}
        placeholderTextColor={DARK.faint}
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure && !show}
        {...rest}
      />
      {secure ? (
        <TouchableOpacity onPress={() => setShow((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={21} color={DARK.faint} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#2A1A10' },
  shellContent: { flex: 1, paddingHorizontal: 24 },
  shellScroll: { flexGrow: 1, paddingTop: 24, paddingBottom: 12 },
  brandWrap: { alignItems: 'center', gap: 10, marginBottom: 30 },
  logo: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: 'rgba(251,246,239,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontFamily: serif, fontSize: 32, fontWeight: '700', color: DARK.text, marginTop: 6 },
  tagline: { fontSize: 15, lineHeight: 22, color: DARK.soft, textAlign: 'center' },
  pillInput: {
    height: 54, borderRadius: 999, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DARK.pill, borderWidth: 1, borderColor: DARK.pillBorder,
  },
  pillInner: { flex: 1, color: DARK.text, fontSize: 16, paddingVertical: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', height: 44, gap: 12 },
  topSide: { width: 44, height: 44, justifyContent: 'center' },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: 'rgba(251,246,239,0.2)' },
  segmentOn: { backgroundColor: DARK.gold },
  skip: { color: DARK.soft, fontSize: 15, fontWeight: '600' },
  h1: { fontFamily: serif, fontSize: 29, lineHeight: 35, fontWeight: '700', color: DARK.text },
  sub: { fontSize: 15, lineHeight: 22, color: DARK.soft, marginTop: 8 },
  btn: {
    height: 56, borderRadius: 999, backgroundColor: DARK.text, alignItems: 'center',
    justifyContent: 'center', overflow: 'visible',
  },
  btnGold: { backgroundColor: DARK.gold },
  btnText: { color: DARK.ink, fontSize: 17, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(138,59,47,0.35)', borderWidth: 1, borderColor: 'rgba(255,180,168,0.5)',
    borderRadius: 12, padding: 12, marginBottom: 14,
  },
  errorText: { color: DARK.error, fontSize: 13.5, lineHeight: 19 },

  appleBtn: {
    height: 54, borderRadius: 999, backgroundColor: DARK.text, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10,
  },
  appleText: { color: DARK.ink, fontSize: 16, fontWeight: '600' },
  googleBtn: {
    height: 54, borderRadius: 999, backgroundColor: DARK.pill, borderWidth: 1, borderColor: 'rgba(251,246,239,0.28)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleText: { color: DARK.text, fontSize: 16, fontWeight: '600' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(251,246,239,0.2)' },
  orText: { color: DARK.faint, fontSize: 13 },
});
