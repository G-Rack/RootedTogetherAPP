import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradient, PrimaryButton, DARK } from '../components/DarkUI';
import { serif } from '../theme';

// Shown once, right after the short sign-up finishes and the new account has
// signed in. "Start exploring" drops into the app; "Finish my profile now"
// opens the profile checklist straight away.
export default function WelcomeScreen({ onStart, onFinishProfile }) {
  const insets = useSafeAreaInsets();
  const todo = [
    ['camera-outline', 'Add a profile photo'],
    ['book-outline', 'Share your story'],
    ['globe-outline', "Tell us where you're from"],
  ];

  return (
    <View style={styles.root}>
      <Gradient />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.check}>
          <Ionicons name="checkmark" size={46} color={DARK.gold} />
        </View>
        <Text style={styles.title}>You're in. Welcome.</Text>
        <Text style={styles.body}>
          Your account is ready. Have a look around, and add more about yourself whenever you like.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>WHEN YOU'RE READY</Text>
          {todo.map(([icon, label]) => (
            <View key={label} style={styles.todoRow}>
              <Ionicons name={icon} size={20} color={DARK.gold} />
              <Text style={styles.todoText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, minHeight: 32 }} />
        <PrimaryButton label="Start exploring" onPress={onStart} />
        <TouchableOpacity style={styles.linkBtn} onPress={onFinishProfile} activeOpacity={0.7}>
          <Text style={styles.linkText}>Finish my profile now</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A1A10' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'stretch' },
  check: {
    alignSelf: 'center', width: 96, height: 96, borderRadius: 48, borderWidth: 1.5,
    borderColor: 'rgba(232,196,138,0.6)', backgroundColor: 'rgba(232,196,138,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: serif, fontSize: 32, lineHeight: 38, fontWeight: '700', color: DARK.text, textAlign: 'center', marginTop: 28 },
  body: { fontSize: 16, lineHeight: 24, color: DARK.soft, textAlign: 'center', marginTop: 10, paddingHorizontal: 18 },
  card: {
    marginTop: 34, padding: 18, borderRadius: 22, backgroundColor: DARK.pill,
    borderWidth: 1, borderColor: DARK.pillBorder, gap: 14,
  },
  cardKicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: DARK.gold },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  todoText: { color: DARK.text, fontSize: 15 },
  linkBtn: { alignItems: 'center', justifyContent: 'center', height: 50, marginTop: 10 },
  linkText: { color: DARK.text, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});
