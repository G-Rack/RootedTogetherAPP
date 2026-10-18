import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
