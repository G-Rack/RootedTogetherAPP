import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { useProfileChecklist } from '../profileChecklist';

// The "Finish your profile" card at the top of Explore. Only shows while
// the checklist has something left; the X hides it until the next time the
// Explore tab is opened.
export default function FinishProfileCard({ session, onPress }) {
  const { checklist } = useProfileChecklist(session);
  const [hidden, setHidden] = useState(false);

  if (hidden || !checklist || checklist.complete || checklist.total === 0) return null;

  const pct = Math.round((checklist.done / checklist.total) * 100);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.close}
        onPress={() => setHidden(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Hide this card"
      >
        <Ionicons name="close" size={18} color={colors.textSoft} />
      </TouchableOpacity>

      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-outline" size={22} color={colors.cream} />
        </View>
        <View style={{ flex: 1, paddingRight: 18 }}>
          <Text style={styles.title}>Finish your profile</Text>
          <Text style={styles.sub}>
            {checklist.done} of {checklist.total} done. People connect with a full profile.
          </Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.btnText}>Continue my profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamDark, borderWidth: 1, borderColor: colors.brownPale,
    borderRadius: 20, padding: 16, marginBottom: 14, gap: 12,
  },
  close: { position: 'absolute', top: 12, right: 12, zIndex: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brown,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: serif, fontSize: 18, fontWeight: '700', color: colors.brown },
  sub: { fontSize: 13, lineHeight: 18, color: colors.textSoft, marginTop: 1 },
  track: { height: 6, borderRadius: 6, backgroundColor: 'rgba(107,66,38,0.15)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.brown },
  btn: {
    height: 46, borderRadius: 999, backgroundColor: colors.brown,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
