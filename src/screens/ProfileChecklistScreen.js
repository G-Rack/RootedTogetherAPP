import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';

// "Complete your profile" — everything the short sign-up skipped, as a
// tappable checklist. Every row opens Edit Profile (which holds all the
// original sign-up questions) except the photo, which opens the photo
// picker directly.
export default function ProfileChecklistScreen({ checklist, onBack, onEdit, onPickPhoto }) {
  if (!checklist) return null;
  const pct = checklist.total ? Math.round((checklist.done / checklist.total) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color={colors.brown} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Your profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Complete your profile</Text>
        <Text style={styles.sub}>
          {checklist.complete
            ? 'All done. Thank you.'
            : `${checklist.done} of ${checklist.total} done. Add these any time, in any order.`}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        <View style={styles.card}>
          {checklist.items.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.row, i > 0 && styles.rowBorder]}
              onPress={item.key === 'photo' ? onPickPhoto : onEdit}
              activeOpacity={0.6}
            >
              <View style={[styles.dot, item.done && styles.dotDone]}>
                {item.done ? <Ionicons name="checkmark" size={14} color={colors.cream} /> : null}
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              {!item.done ? <Text style={styles.rowHint}>{item.optional ? 'Optional' : 'Add'}</Text> : null}
              <Ionicons name="chevron-forward" size={17} color={colors.brownLight} />
            </TouchableOpacity>
          ))}
        </View>

        {checklist.showCredentials ? (
          <TouchableOpacity style={styles.credCard} onPress={onEdit} activeOpacity={0.8}>
            <View style={styles.credIcon}>
              <Ionicons name="shield-outline" size={20} color={colors.cream} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.credKicker}>MOTHERS, PASTORS &amp; CHURCHES</Text>
              <Text style={styles.credTitle}>Credentials &amp; verification</Text>
              <Text style={styles.credSub}>Optional. Add it any time to help people trust your profile.</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.brownLight} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{checklist.complete ? 'Go to my profile' : 'Skip for now, go to my profile'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 18, color: colors.brown, fontWeight: '700' },
  body: { paddingTop: 16, paddingBottom: 16 },
  footer: { paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)', backgroundColor: colors.white },
  primaryBtn: { height: 52, borderRadius: 999, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  h1: { fontFamily: serif, fontSize: 25, lineHeight: 31, fontWeight: '700', color: colors.brown },
  sub: { fontSize: 14, lineHeight: 20, color: colors.textSoft, marginTop: 4, marginBottom: 12 },
  track: { height: 6, borderRadius: 6, backgroundColor: 'rgba(107,66,38,0.15)', overflow: 'hidden', marginBottom: 18 },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.brown },
  card: {
    borderRadius: 18, backgroundColor: colors.white, borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.12)', overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)' },
  dot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.brownPale,
    alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.brown, borderColor: colors.brown },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 12.5, color: colors.textSoft },
  credCard: {
    marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: colors.creamDark,
    borderWidth: 1, borderColor: colors.brownPale, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  credIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brown,
    alignItems: 'center', justifyContent: 'center',
  },
  credKicker: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, color: colors.brown },
  credTitle: { fontSize: 14.5, fontWeight: '700', color: colors.text, marginTop: 2 },
  credSub: { fontSize: 12.5, lineHeight: 17, color: colors.textSoft, marginTop: 2 },
});
