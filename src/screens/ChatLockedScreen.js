import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';

// The Premium upsell — shown either as the whole Chat tab (a free member
// with zero conversations has nothing else to see there) or as a one-off
// screen when a free member taps "Send a message" on someone they've
// never talked to before.
//
// Real policy, straight from Girik: there's no billing anywhere in this
// app yet, so "Upgrade to Premium" doesn't charge anything — it just sets
// the person's is_premium flag on their own profiles row and continues
// whatever they were trying to do (open the Chat tab's real list, or
// start that new conversation). That's a deliberate, explicit call for
// this round, not a shortcut taken quietly — worth revisiting once real
// billing exists.
export default function ChatLockedScreen({ onUpgrade, targetName }) {
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState(null);

  async function handleUpgrade() {
    setUpgrading(true);
    setError(null);
    try {
      await onUpgrade();
    } catch (e) {
      setError('Couldn’t upgrade right now. Please try again.');
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Chat</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.brown} />
        </View>
        <Text style={styles.title}>Unlock Conversations</Text>
        <Text style={styles.subtitle}>
          {targetName
            ? `Browsing Explore and the Directory is free. Starting a new conversation with ${targetName} needs a Premium membership.`
            : 'Browsing Explore and the Directory is free. Starting a new conversation with a Seeker, Mother, Pastor, or Assistant needs a Premium membership.'}
        </Text>

        <View style={styles.perksCard}>
          <View style={styles.perkRow}>
            <Ionicons name="checkmark" size={17} color={colors.brown} />
            <Text style={styles.perkText}>Start and reply to unlimited conversations</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={upgrading} activeOpacity={0.8}>
          {upgrading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          )}
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.footnote}>Already have a conversation someone started with you? Replying is always free.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: { paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)' },
  topBarTitle: { fontFamily: serif, fontSize: 21, color: colors.brown, fontWeight: '700' },
  body: { alignItems: 'center', paddingTop: 44, paddingHorizontal: 8 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 999, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  title: { fontFamily: serif, fontSize: 19, color: colors.brown, fontWeight: '700', marginTop: 6 },
  subtitle: { fontSize: 13.5, color: colors.textSoft, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  perksCard: {
    alignSelf: 'stretch', backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)',
    borderRadius: 14, padding: 16, gap: 10, marginTop: 20,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkText: { fontSize: 13, color: colors.text, flexShrink: 1 },
  upgradeBtn: {
    alignSelf: 'stretch', backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 13,
    alignItems: 'center', marginTop: 18, overflow: 'visible',
  },
  upgradeBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },
  footnote: { fontSize: 11.5, color: colors.textSoft, textAlign: 'center', marginTop: 10 },
  errorText: { fontSize: 12.5, color: colors.errorText, textAlign: 'center', marginTop: 14 },
});
