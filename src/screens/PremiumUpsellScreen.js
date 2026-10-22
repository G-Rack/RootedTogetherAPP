import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { WEB_BASE_URL } from '../config';
import {
  PLANS, isBillingConfigured, loadPlanPackages, purchasePlan, restorePurchases, storeLabel,
} from '../billing';

// The Premium upsell. Shown in two places that both gate on the same
// membership: the Chat tab (a free member with zero conversations has
// nothing else to see there, and the same screen reappears as a one-off
// when they tap "Send a message" on someone new) and the Family tab (a
// free Seeker/Assistant with no Spiritual Family yet — browsing who's out
// there is free, requesting to join is the Premium-gated action, same
// shape as Chat, where messaging and replying both need Premium).
//
// One shared component, not two copies, because it's one membership with
// one set of perks — `context` only swaps the header, the lead icon, which
// perk is listed first, and the reassurance footnote; the copy and the
// perk list itself are otherwise identical by design.
//
// Billing: Premium is a store subscription ($49/year or $5.99/month) sold
// through Google Play / Apple via RevenueCat (see billing.js). After a
// successful purchase, onUpgrade() runs exactly as before — it marks the
// person Premium and continues whatever they were doing. Until RevenueCat
// keys are filled in, the button falls back to that free upgrade so
// testing isn't blocked.
// One membership, one perk list, for everyone (Seekers, Assistants, Leaders,
// Mothers, Pastors, Churches). Only list what Premium really unlocks today:
// starting/replying to conversations and joining or leading a Spiritual Family.
// Add new lines here only once the feature is built and gated.
const PERKS = {
  conversations: 'Start and reply to unlimited conversations with Leaders, Mothers, Pastors, Assistants & Seekers',
  family: 'Join or lead a Spiritual Family circle',
  growth: 'New Premium features as they launch',
};

const CONTEXT = {
  chat: {
    topBarTitle: 'Chat',
    perkOrder: ['conversations', 'family', 'growth'],
    footnote: 'Someone messaged you? You can read it for free — Premium lets you reply and reach out.',
  },
  family: {
    topBarTitle: 'Family',
    perkOrder: ['family', 'conversations', 'growth'],
    footnote: 'Browsing Spiritual Families is always free — Premium is only needed to join or lead one.',
  },
};

export default function PremiumUpsellScreen({ onUpgrade, targetName, context = 'chat' }) {
  const [plan, setPlan] = useState('yearly');
  const [packages, setPackages] = useState({ yearly: null, monthly: null });
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const cfg = CONTEXT[context] || CONTEXT.chat;
  const perks = PERKS;
  const billing = isBillingConfigured();

  useEffect(() => {
    if (!billing) return;
    loadPlanPackages().then(setPackages);
  }, [billing]);

  const subtitle = targetName
    ? `Upgrade to message ${targetName}, join or lead a Spiritual Family circle, and keep growing in community.`
    : 'Message Leaders and the community directly, and join or lead a Spiritual Family circle.';

  // Store prices win once loaded (they're localized); otherwise our list prices.
  const priceOf = (key) => packages[key]?.product?.priceString || PLANS[key].price;
  const yearlyPerMonth = packages.yearly?.product?.pricePerMonthString || PLANS.yearly.perMonth;
  const selected = PLANS[plan];
  const ctaLabel = `Start Premium · ${priceOf(plan)}/${plan === 'yearly' ? 'year' : 'month'}`;
  const finePrint = `${plan === 'yearly' ? `Billed ${priceOf('yearly')} once a year` : `Billed ${priceOf('monthly')} every month`} through ${storeLabel()}. Renews automatically; cancel anytime in your ${storeLabel()} subscriptions.`;

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (billing) {
        const pkg = packages[plan];
        if (!pkg) {
          setError('Plans are still loading. Please try again in a moment.');
          return;
        }
        const active = await purchasePlan(pkg);
        if (!active) return; // closed the store sheet
      }
      await onUpgrade();
    } catch (e) {
      setError('Couldn’t complete the purchase. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      if (billing && (await restorePurchases())) {
        await onUpgrade();
      } else {
        setNotice('No active Premium subscription was found for this account.');
      }
    } catch (e) {
      setError('Couldn’t restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  const planCard = (key) => {
    const on = plan === key;
    const p = PLANS[key];
    return (
      <TouchableOpacity
        key={key}
        style={[styles.planCard, on && styles.planCardOn]}
        onPress={() => setPlan(key)}
        activeOpacity={0.85}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
      >
        {key === 'yearly' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BEST VALUE · SAVE 32%</Text>
          </View>
        )}
        <View style={[styles.radio, on && styles.radioOn]}>
          {on && <View style={styles.radioDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{p.label}</Text>
          <Text style={styles.planSub}>
            {key === 'yearly' ? `Just ${yearlyPerMonth} a month, billed yearly` : 'Flexible, cancel anytime'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.planPrice}>{priceOf(key)}</Text>
          <Text style={styles.planPeriod}>{p.period}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>{cfg.topBarTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Ionicons name="star-outline" size={28} color={colors.brown} />
          </View>
          <Text style={styles.title}>Unlock Premium</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.plans} accessibilityRole="radiogroup">
          {planCard('yearly')}
          {planCard('monthly')}
        </View>

        <View style={styles.perksCard}>
          <Text style={styles.perksLabel}>EVERYTHING IN PREMIUM</Text>
          {cfg.perkOrder.map((key) => (
            <View style={styles.perkRow} key={key}>
              <Ionicons name="checkmark" size={18} color={colors.brown} />
              <Text style={styles.perkText}>{perks[key]}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.upgradeBtnText}>{ctaLabel}</Text>}
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        <Text style={styles.finePrint}>{finePrint}</Text>

        <View style={styles.links}>
          <TouchableOpacity onPress={handleRestore} disabled={restoring} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            {restoring ? <ActivityIndicator size="small" color={colors.brown} /> : <Text style={styles.linkText}>Restore purchases</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE_URL}/terms`)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <Text style={styles.linkText}>Terms</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(`${WEB_BASE_URL}/privacy`)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <Text style={styles.linkText}>Privacy</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footnote}>{cfg.footnote}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topBar: { paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)' },
  topBarTitle: { fontFamily: serif, fontSize: 21, color: colors.brown, fontWeight: '700' },
  body: { paddingTop: 18, paddingBottom: 24, gap: 18 },
  hero: { alignItems: 'center', gap: 8 },
  iconCircle: {
    width: 60, height: 60, borderRadius: 999, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: serif, fontSize: 23, color: colors.brown, fontWeight: '700', marginTop: 4 },
  subtitle: { fontSize: 14, color: colors.textSoft, textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },
  plans: { gap: 12, marginTop: 4 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: colors.brownPale, backgroundColor: colors.white, overflow: 'visible',
  },
  planCardOn: { borderWidth: 2, borderColor: colors.brown, backgroundColor: colors.cream },
  badge: {
    position: 'absolute', top: -11, left: 16, backgroundColor: colors.brown, borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  badgeText: { color: colors.white, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.brownPale,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.brown },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brown },
  planName: { fontSize: 16, fontWeight: '700', color: colors.text },
  planSub: { fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  planPrice: { fontSize: 19, fontWeight: '700', color: colors.text },
  planPeriod: { fontSize: 11.5, color: colors.textSoft, marginTop: 1 },
  perksCard: { backgroundColor: colors.cream, borderRadius: 16, padding: 16, gap: 11 },
  perksLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, color: colors.brown },
  perkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  perkText: { fontSize: 14, lineHeight: 19, color: colors.text, flexShrink: 1 },
  upgradeBtn: {
    backgroundColor: colors.brown, borderRadius: 999, minHeight: 54, justifyContent: 'center',
    alignItems: 'center', overflow: 'visible',
  },
  upgradeBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  finePrint: { fontSize: 11.5, lineHeight: 16, color: colors.textSoft, textAlign: 'center', marginTop: -6 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  linkText: { fontSize: 12.5, fontWeight: '700', color: colors.brown },
  footnote: { fontSize: 12, color: colors.textSoft, textAlign: 'center' },
  errorText: { fontSize: 12.5, color: colors.errorText, textAlign: 'center', marginTop: -6 },
  noticeText: { fontSize: 12.5, color: colors.textSoft, textAlign: 'center', marginTop: -6 },
});
