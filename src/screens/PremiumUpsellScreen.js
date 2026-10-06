import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';

// The Premium upsell. Shown in two places that both gate on the same
// membership: the Chat tab (a free member with zero conversations has
// nothing else to see there, and the same screen reappears as a one-off
// when they tap "Send a message" on someone new) and the Family tab (a
// free Seeker/Assistant with no Spiritual Family yet — browsing who's out
// there is free, requesting to join is the Premium-gated action, same
// shape as Chat's "replying is free, starting new isn't").
//
// One shared component, not two copies, because it's one membership with
// one set of perks — `context` only swaps the header, the lead icon, which
// perk is listed first, and the reassurance footnote; the copy and the
// perk list itself are otherwise identical by design.
//
// Real policy, straight from Girik: there's no billing anywhere in this
// app yet, so "Upgrade to Premium" doesn't charge anything — it just sets
// the person's is_premium flag on their own profiles row and continues
// whatever they were trying to do (open the Chat tab's real list, start
// that new conversation, or reveal the real Family empty-state so they can
// go request to join one). That's a deliberate, explicit call for this
// round, not a shortcut taken quietly — worth revisiting once real billing
// exists.
const PERKS = {
  conversations: 'Unlimited conversations with Leaders, Mothers, Pastors & Assistants',
  family: 'Join a Spiritual Family circle',
  marketplace: 'Save on Marketplace offerings from Spiritual Leaders',
  active: "See who's active right now",
  priority: "Priority replies from Leaders' teams",
};

const CONTEXT = {
  chat: {
    topBarTitle: 'Chat',
    icon: 'chatbubble-ellipses-outline',
    perkOrder: ['conversations', 'family', 'marketplace', 'active', 'priority'],
    footnote: 'Already have a conversation someone started with you? Replying is always free.',
  },
  family: {
    topBarTitle: 'Family',
    icon: 'heart-outline',
    perkOrder: ['family', 'conversations', 'marketplace', 'active', 'priority'],
    footnote: 'Browsing Spiritual Families is always free — Premium is only needed to request to join one.',
  },
};

export default function PremiumUpsellScreen({ onUpgrade, targetName, context = 'chat' }) {
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState(null);

  const cfg = CONTEXT[context] || CONTEXT.chat;

  const subtitle = targetName
    ? `Upgrade to start messaging ${targetName} — plus join a Spiritual Family circle and save on the Marketplace.`
    : 'Upgrade to unlock direct messaging, join a Spiritual Family circle, and save on the Rooted Together Marketplace.';

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
        <Text style={styles.topBarTitle}>{cfg.topBarTitle}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name={cfg.icon} size={30} color={colors.brown} />
        </View>
        <Text style={styles.title}>Unlock Premium</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.perksCard}>
          {cfg.perkOrder.map((key) => (
            <View style={styles.perkRow} key={key}>
              <Ionicons name="checkmark" size={17} color={colors.brown} />
              <Text style={styles.perkText}>{PERKS[key]}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={upgrading} activeOpacity={0.8}>
          {upgrading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          )}
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.footnote}>{cfg.footnote}</Text>
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
