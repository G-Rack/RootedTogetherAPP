import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, serif } from '../theme';
import FieldControl from '../components/FieldControl';

export default function StepScreen({ step, draft, onChange, onBack, onNext, isFirstStep, isLastStep, submitting }) {
  // A field can carry its own `condition(draft)`, same shape as a step's —
  // e.g. "Child's age" only makes sense once "Who are you signing up for?"
  // is answered "My child". Evaluated live against the in-progress draft,
  // so it appears/disappears immediately as the earlier answer changes,
  // without waiting for Continue.
  const visibleFields = step.fields.filter((f) => !f.condition || f.condition(draft));

  return (
    <View>
      <Text style={styles.h1}>{step.title}</Text>
      {step.sub ? <Text style={styles.sub}>{step.sub}</Text> : null}

      {visibleFields.map((f) => (
        <FieldControl key={f.name} field={f} value={draft[f.name]} onChange={onChange} />
      ))}

      {step.safetyNote ? (
        <Text style={styles.safety}>
          If you're in immediate crisis, please contact a local crisis line or emergency services — this app isn't monitored in real time.
        </Text>
      ) : null}

      <View style={styles.nav}>
        <TouchableOpacity style={styles.ghostBtn} onPress={onBack} disabled={submitting}>
          <Text style={styles.ghostBtnText}>{isFirstStep ? 'Start over' : 'Back'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={onNext} disabled={submitting}>
          <Text style={styles.btnText}>{submitting ? 'Submitting…' : isLastStep ? 'Submit' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 24, color: colors.brown, marginBottom: 6, fontWeight: '700' },
  sub: { fontSize: 14.5, color: colors.textSoft, marginBottom: 22 },
  safety: {
    fontSize: 12.5, color: colors.textSoft, opacity: 0.85, marginTop: 12,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)',
  },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  btn: { backgroundColor: colors.brown, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 999 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  ghostBtnText: { color: colors.brown, fontSize: 15, fontWeight: '600' },
});
