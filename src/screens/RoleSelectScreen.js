import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, serif } from '../theme';
import { FLOWS } from '../flows';

const ROLE_ORDER = [
  { key: 'seeker', title: 'I am a Spiritual Seeker' },
  { key: 'assistant', title: 'I want to be a Spiritual Assistant' },
  { key: 'mother', title: 'I am a Spiritual Mother' },
  { key: 'priest', title: "I'm a Priest or Pastor" },
  { key: 'influencer', title: "I'm a Spiritual Leader" },
];

export default function RoleSelectScreen({ onSelect, onLoginPress }) {
  return (
    <View>
      <Text style={styles.h1}>Which one are you?</Text>
      <Text style={styles.sub}>Pick the option that fits — each has a couple of quick questions tailored to it.</Text>
      <View style={{ gap: 14 }}>
        {ROLE_ORDER.map((r) => (
          <TouchableOpacity key={r.key} style={styles.card} onPress={() => onSelect(r.key)}>
            <Text style={styles.cardTitle}>{r.title}</Text>
            <Text style={styles.cardSub}>{FLOWS[r.key].intro}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.loginRow} onPress={onLoginPress}>
        <Text style={styles.loginText}>Already have an account? <Text style={styles.loginLink}>Log in</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 26, color: colors.brown, marginBottom: 8, fontWeight: '700' },
  sub: { fontSize: 14.5, color: colors.textSoft, marginBottom: 24 },
  card: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.14)',
    borderRadius: 12,
    padding: 18,
  },
  cardTitle: { fontFamily: serif, fontSize: 17, color: colors.brown, marginBottom: 4, fontWeight: '700' },
  cardSub: { fontSize: 13.5, color: colors.textSoft },
  loginRow: { marginTop: 22, alignItems: 'center' },
  loginText: { fontSize: 13.5, color: colors.textSoft },
  loginLink: { color: colors.brown, fontWeight: '700' },
});
