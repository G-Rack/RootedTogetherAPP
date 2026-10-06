import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, serif } from '../theme';

// Shown right after the required first step of sign-up (name, email,
// password, date of birth, and whatever else that role's "core" step
// asks) — before the optional "tell us more about yourself" step(s) that
// follow for every role. Lets someone choose between finishing the rest
// now or jumping straight into the app, matching the approved design
// mockup (the canvas's Decision.dc.html artboard).
//
// "Skip for now" is a real skip, not a soft nudge: it submits the account
// with just what's been entered so far and drops straight into the
// signed-in app (see App.js's handleDecisionSkip) — everything this step
// would otherwise have collected can be filled in later from Profile ->
// Settings -> Edit Profile, which now has the complete original sign-up
// form for every field, not just a subset.
export default function SignupDecisionScreen({ onBack, onContinue, onSkip, submitting }) {
  return (
    <View>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backBtn}
        disabled={submitting}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.backChevron}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Nice work — you’re almost in.</Text>
      <Text style={styles.subtitle}>
        Want to share a little more about yourself now, or jump straight into Rooted Together? Either way, you can always finish up later.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>▽</Text>
        <Text style={styles.cardTitle}>Add a few more details</Text>
        <Text style={styles.cardBody}>About 2 minutes — your story, interests, and (for some roles) your credentials.</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.btnDisabled]}
          onPress={onContinue}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardIcon}>▷</Text>
        <Text style={styles.cardTitle}>Skip for now</Text>
        <Text style={styles.cardBody}>Jump right into the app. Add these details anytime from Profile → Settings → Edit Profile.</Text>
        <TouchableOpacity
          style={[styles.ghostBtn, submitting && styles.btnDisabled]}
          onPress={onSkip}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.brown} />
          ) : (
            <Text style={styles.ghostBtnText}>Skip & start exploring</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footnote}>Nothing is lost — your skipped answers will be waiting whenever you’re ready.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: { alignSelf: 'flex-start', marginBottom: 14 },
  backChevron: { fontSize: 26, color: colors.text, fontWeight: '700' },

  title: { fontFamily: serif, fontSize: 25, color: colors.text, fontWeight: '700', lineHeight: 31, marginBottom: 10 },
  subtitle: { fontSize: 14, color: colors.textSoft, lineHeight: 20, marginBottom: 22 },

  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.12)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  cardIcon: { fontSize: 15, color: colors.brownLight, marginBottom: 6 },
  cardTitle: { fontSize: 15.5, color: colors.text, fontWeight: '700', marginBottom: 6 },
  cardBody: { fontSize: 13, color: colors.textSoft, lineHeight: 18.5, marginBottom: 16 },

  primaryBtn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },

  ghostBtn: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999,
    paddingVertical: 13, alignItems: 'center', backgroundColor: colors.white,
  },
  ghostBtnText: { color: colors.brown, fontSize: 14.5, fontWeight: '700' },

  btnDisabled: { opacity: 0.6 },

  footnote: { fontSize: 12, color: colors.textSoft, textAlign: 'center', fontStyle: 'italic', marginTop: 18, lineHeight: 17 },
});
