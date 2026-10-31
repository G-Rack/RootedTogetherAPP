import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Share, Platform,
  Linking, ActivityIndicator, RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import { WEB_BASE_URL } from '../config';

// Payouts & Referrals for Leader roles (Mothers, Pastors, Influencers).
// Every number here is read live from the same Supabase project as the website
// dashboard:
//   - Balance / pending / payouts: the creator's own Stripe balance, through the
//     stripe-connect-onboarding function (the same one the website's Payouts
//     page uses). "Request Payout" really pays the available balance to their
//     bank (minimum is enforced by the function).
//   - Earnings and recent sales: offering_purchases for their offerings plus paid
//     prayer / meditation requests, counted net of platform and card fees.
//   - Referrals: the member's RT-00042 code, how many people signed up with it,
//     their tier, and the cuts recorded in referral_earnings. Referral cuts are a
//     tracked ledger, not part of the Stripe balance, so they are labelled as such.
// Creators who have not finished Stripe setup see their earnings plus a button to
// finish setup on the website (identity and bank details are collected by Stripe
// on their hosted page, never inside the app).
// Copy Code / Share Link use the native Share sheet (which includes Copy), so no
// clipboard dependency is needed.

const SERVICE_LABELS = { prayer: 'Prayer request', meditation: 'Meditation request' };
const PAYOUTS_URL = `${WEB_BASE_URL}/dashboard/payouts`;
const REFERRALS_URL = `${WEB_BASE_URL}/dashboard/referrals`;

function money(cents) {
  const n = (Number(cents) || 0) / 100;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// What the creator keeps from one sale: the price minus our 10% platform fee.
// Stripe's card fee is paid by Rooted Together out of that 10%, not by the creator.
function netOf(row, amountKey) {
  const gross = Number(row[amountKey]) || 0;
  const net = gross - (Number(row.platform_fee_cents) || 0);
  return Math.max(0, net);
}

// Calls the signed-in creator's Stripe function and returns { data } or { error }.
async function callConnect(action) {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding', { body: { action } });
    if (error) {
      let message = 'Something went wrong. Please try again.';
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        // keep the generic message
      }
      return { error: message };
    }
    if (data?.error) return { error: data.error };
    return { data };
  } catch {
    return { error: 'Couldn’t reach the server. Check your connection and try again.' };
  }
}

export default function PayoutsReferralsScreen({ onBack, person }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Earnings
  const [lifetimeCents, setLifetimeCents] = useState(0);
  const [monthCents, setMonthCents] = useState(0);
  const [sales, setSales] = useState([]);

  // Stripe
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [balance, setBalance] = useState(null); // { availableCents, pendingCents, minPayoutCents }
  const [balanceError, setBalanceError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [openingStripe, setOpeningStripe] = useState(false);

  // Referrals
  const [realCode, setRealCode] = useState(undefined); // undefined = loading, null = none
  const [refStatus, setRefStatus] = useState(null);
  const [referredCount, setReferredCount] = useState(0);
  const [refEarningsCents, setRefEarningsCents] = useState(0);
  const [tiers, setTiers] = useState([]);
  const [refEarnings, setRefEarnings] = useState([]);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      setLoadError('You need to be signed in to see this.');
      setLoading(false);
      return;
    }

    // Offerings first, so their purchases can be found.
    const offeringsRes = await supabase.from('offerings').select('id, title').eq('creator_auth_id', uid);
    const offerings = offeringsRes.data || [];
    const titleById = Object.fromEntries(offerings.map((o) => [o.id, o.title]));
    const offeringIds = offerings.map((o) => o.id);

    const [purchasesRes, servicesRes, profileRes, codeRes, statusRes, summaryRes, tiersRes, earningsRes] = await Promise.all([
      offeringIds.length
        ? supabase
          .from('offering_purchases')
          .select('offering_id, price_paid_cents, platform_fee_cents, stripe_fee_cents, purchased_at')
          .in('offering_id', offeringIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('service_requests')
        .select('service_type, amount_cents, platform_fee_cents, stripe_fee_cents, paid_at')
        .eq('creator_auth_id', uid)
        .gt('amount_cents', 0)
        .not('paid_at', 'is', null),
      supabase.from('profiles').select('stripe_payouts_enabled').eq('id', uid).maybeSingle(),
      supabase.rpc('get_my_referral_code'),
      supabase.rpc('get_my_referral_status'),
      supabase.rpc('get_my_referral_summary'),
      supabase.from('referral_tiers').select('*').order('sort_order', { ascending: true }),
      supabase
        .from('referral_earnings')
        .select('id, referred_name, offering_title, cut_cents, created_at')
        .eq('referrer_auth_id', uid)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    if (purchasesRes.error || servicesRes.error) {
      setLoadError('Couldn’t load your earnings. Pull down to try again.');
    }

    const rows = [
      ...(purchasesRes.data || []).map((p) => ({
        key: `p-${p.offering_id}-${p.purchased_at}`,
        date: p.purchased_at,
        title: titleById[p.offering_id] || 'Offering',
        net: netOf(p, 'price_paid_cents'),
      })),
      ...(servicesRes.data || []).map((s) => ({
        key: `s-${s.service_type}-${s.paid_at}`,
        date: s.paid_at,
        title: SERVICE_LABELS[s.service_type] || 'Service request',
        net: netOf(s, 'amount_cents'),
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    setLifetimeCents(rows.reduce((sum, r) => sum + r.net, 0));
    setMonthCents(rows.filter((r) => new Date(r.date) >= monthStart).reduce((sum, r) => sum + r.net, 0));
    setSales(rows.slice(0, 6));

    setRealCode(codeRes.data || null);
    setRefStatus(statusRes.data || null);
    const summary = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
    setReferredCount(summary?.referred_count || 0);
    setRefEarningsCents(Number(summary?.earnings_cents) || 0);
    setTiers(tiersRes.data || []);
    setRefEarnings(earningsRes.data || []);

    const enabled = !!profileRes.data?.stripe_payouts_enabled;
    setPayoutsEnabled(enabled);
    if (enabled) {
      const res = await callConnect('balance');
      setBalance(res.data || null);
      setBalanceError(res.error || null);
    } else {
      setBalance(null);
      setBalanceError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openWebsite(url) {
    Linking.openURL(url).catch(() => {
      Alert.alert('Couldn’t open the page', `Open ${url.replace('https://', '')} in your browser.`);
    });
  }

  function handleRequestPayout() {
    if (!payoutsEnabled) return openWebsite(PAYOUTS_URL);
    if (!balance) return Alert.alert('Balance unavailable', balanceError || 'Pull down to refresh and try again.');
    if (balance.availableCents < balance.minPayoutCents) {
      return Alert.alert('Not enough to pay out yet', `You need at least ${money(balance.minPayoutCents)} available. You have ${money(balance.availableCents)}.`);
    }
    Alert.alert(
      'Request payout',
      `Send ${money(balance.availableCents)} to your bank account? It usually arrives in 1 to 3 business days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Pay out ${money(balance.availableCents)}`,
          onPress: async () => {
            setPaying(true);
            const res = await callConnect('payout');
            setPaying(false);
            if (res.error) return Alert.alert('Payout didn’t go through', res.error);
            const arrival = res.data?.arrivalDate
              ? ` Expected around ${shortDate(new Date(res.data.arrivalDate * 1000).toISOString())}.`
              : '';
            Alert.alert('Payout requested', `${money(res.data?.amountCents)} is on its way to your bank.${arrival}`);
            load();
          },
        },
      ],
    );
  }

  async function handleOpenStripe() {
    setOpeningStripe(true);
    const res = await callConnect('dashboard');
    setOpeningStripe(false);
    if (res.error || !res.data?.url) return Alert.alert('Couldn’t open Stripe', res.error || 'Please try again.');
    openWebsite(res.data.url);
  }

  const referralCode = realCode || (realCode === undefined ? '…' : 'Not approved yet');
  const referralLink = realCode ? `${WEB_BASE_URL}/join?ref=${encodeURIComponent(realCode)}` : null;

  function notApprovedAlert() {
    const body = refStatus === 'pending'
      ? 'Your referral application is being reviewed. Your code appears here once you are approved.'
      : 'Apply to the referral program from the Referrals page of your dashboard at rootedtogether.club. Your code appears here once you are approved.';
    Alert.alert('No referral code yet', body);
  }

  async function handleCopyCode() {
    if (!realCode) return notApprovedAlert();
    try {
      await Share.share({ message: realCode });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  async function handleShareLink() {
    if (!realCode) return notApprovedAlert();
    try {
      await Share.share({
        message: `Join me on Rooted Together. Open this to get the app, and my invite code ${realCode} is filled in for you: ${referralLink}`,
      });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  // Tier maths, from the live referral_tiers rows.
  const currentTier = tiers.length
    ? [...tiers].reverse().find((t) => referredCount >= t.min_referrals) || null
    : null;
  const nextTier = tiers.find((t) => referredCount < t.min_referrals) || null;
  const tierLine = !tiers.length
    ? null
    : nextTier
      ? `${nextTier.min_referrals - referredCount} more ${nextTier.min_referrals - referredCount === 1 ? 'person' : 'people'} to reach ${nextTier.name}${currentTier ? '' : ', where your earnings begin'} (${nextTier.rate_percent}% of net sales).`
      : 'You are on the top tier.';

  const connected = payoutsEnabled;
  const canPayOut = connected && balance && balance.availableCents >= balance.minPayoutCents;
  const heroLabel = connected ? 'Available Balance' : 'Lifetime earned';
  const heroAmount = connected ? (balance ? money(balance.availableCents) : '—') : money(lifetimeCents);

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Payouts & Referrals</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <ScrollView
          style={styles.wrap}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brown} />}
        >
          {loadError ? <Text style={styles.errorNote}>{loadError}</Text> : null}

          {/* Balance hero card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{heroLabel}</Text>
            <Text style={styles.balanceAmount}>{heroAmount}</Text>

            <View style={styles.balanceRow}>
              {connected ? (
                <View style={{ paddingTop: 12, marginRight: 18 }}>
                  <Text style={styles.balanceSubLabel}>Pending</Text>
                  <Text style={styles.balanceSubValue}>{balance ? money(balance.pendingCents) : '—'}</Text>
                </View>
              ) : null}
              <View style={{ paddingTop: 12, marginRight: 18 }}>
                <Text style={styles.balanceSubLabel}>This month</Text>
                <Text style={styles.balanceSubValue}>{money(monthCents)}</Text>
              </View>
              {connected ? (
                <View style={{ paddingTop: 12 }}>
                  <Text style={styles.balanceSubLabel}>Lifetime earned</Text>
                  <Text style={styles.balanceSubValue}>{money(lifetimeCents)}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.balanceNote}>
              {connected
                ? (balanceError || 'Earnings are after the 10% platform fee. Referral cuts are tracked separately below.')
                : 'Earnings are after the 10% platform fee. Finish Stripe setup on the website to get paid out.'}
            </Text>

            <TouchableOpacity
              style={[styles.payoutBtn, connected && !canPayOut && styles.payoutBtnDisabled]}
              onPress={handleRequestPayout}
              activeOpacity={0.85}
              disabled={paying}
            >
              {paying
                ? <ActivityIndicator color={colors.brown} />
                : <Text style={styles.payoutBtnText}>{connected ? 'Request Payout' : 'Set up payouts'}</Text>}
            </TouchableOpacity>
            {connected && balance && !canPayOut ? (
              <Text style={styles.balanceNote}>Payouts start at {money(balance.minPayoutCents)} available.</Text>
            ) : null}
          </View>

          {connected ? (
            <TouchableOpacity style={styles.linkRow} onPress={handleOpenStripe} disabled={openingStripe} activeOpacity={0.7}>
              <Text style={styles.linkRowText}>{openingStripe ? 'Opening…' : 'Payout history and bank details in Stripe'}</Text>
              <Ionicons name="open-outline" size={16} color={colors.brownLight} />
            </TouchableOpacity>
          ) : null}

          {/* Recent sales */}
          <Text style={styles.sectionLabel}>Recent Sales</Text>
          <View style={styles.card}>
            {sales.length === 0 ? (
              <Text style={styles.emptyText}>No sales yet. When someone buys from you or pays for a prayer or meditation request, it shows here.</Text>
            ) : sales.map((row, i) => (
              <View key={row.key} style={[styles.historyRow, i < sales.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.historyDate}>{row.title}</Text>
                  <Text style={styles.historyMethod}>{shortDate(row.date)}</Text>
                </View>
                <Text style={styles.historyAmount}>{money(row.net)}</Text>
              </View>
            ))}
          </View>

          {/* Referral link */}
          <Text style={styles.sectionLabel}>Your Referral Link</Text>
          <View style={styles.card}>
            <Text style={styles.referralHint}>
              Share your link. It opens the app with your code filled in. People who sign up in the app with your code are connected to you, and you earn a cut of their net purchases.
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referralCode}</Text>
              <Ionicons name="copy-outline" size={18} color={colors.brownLight} />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode} activeOpacity={0.85}>
                <Text style={styles.copyBtnText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareLink} activeOpacity={0.85}>
                <Text style={styles.shareBtnText}>Share Link</Text>
              </TouchableOpacity>
            </View>
            {!realCode && realCode !== undefined ? (
              <TouchableOpacity onPress={() => openWebsite(REFERRALS_URL)} style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                <Text style={styles.inlineLink}>
                  {refStatus === 'pending' ? 'Application under review' : 'Apply on the website'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Referral stats */}
          <View style={styles.statsRow}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{referredCount}</Text>
              <Text style={styles.statLabel}>Signed up</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{currentTier ? currentTier.name : '—'}</Text>
              <Text style={styles.statLabel}>Tier</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{money(refEarningsCents)}</Text>
              <Text style={styles.statLabel}>Referral cuts</Text>
            </View>
          </View>
          {tierLine ? <Text style={styles.tierLine}>{tierLine}</Text> : null}

          {/* Referral earnings */}
          <Text style={styles.sectionLabel}>Recent Referral Earnings</Text>
          <View style={styles.card}>
            {refEarnings.length === 0 ? (
              <Text style={styles.emptyText}>Nothing yet. When someone you invited buys something or pays for a request, your cut appears here.</Text>
            ) : refEarnings.map((r, i) => (
              <View key={r.id} style={[styles.referralRow, i < refEarnings.length - 1 && styles.rowBorder]}>
                <View style={styles.referralAvatar}>
                  <Text style={styles.referralAvatarText}>{(r.referred_name || '?').trim().charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referralName}>{r.referred_name || 'A member you invited'}</Text>
                  <Text style={styles.referralDetail}>{[r.offering_title, shortDate(r.created_at)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={styles.historyAmount}>{money(r.cut_cents)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.tierLine}>Referral cuts are worked out on net sales and tracked here. They are not part of your Stripe balance.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const MONO_FONT = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
    backgroundColor: colors.cream,
  },
  backBtn: { width: 32, alignItems: 'flex-end' },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: colors.brownLight,
    textTransform: 'uppercase', marginBottom: 10, marginTop: 24,
  },

  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)',
    borderRadius: 14, overflow: 'hidden',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)' },

  balanceCard: { backgroundColor: colors.brown, borderRadius: 16, padding: 22, paddingBottom: 20 },
  balanceLabel: {
    fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase', marginBottom: 6,
  },
  balanceAmount: { fontFamily: serif, fontSize: 36, fontWeight: '700', color: colors.white, lineHeight: 40 },
  balanceRow: {
    flexDirection: 'row', marginTop: 14, paddingTop: 2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)',
  },
  balanceSubLabel: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  balanceSubValue: { fontSize: 14, fontWeight: '700', color: colors.white },
  balanceNote: { fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', marginTop: 14 },
  payoutBtn: { backgroundColor: colors.white, borderRadius: 999, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  payoutBtnText: { color: colors.brown, fontSize: 14.5, fontWeight: '700' },
  payoutBtnDisabled: { opacity: 0.55 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4, marginTop: 6,
  },
  linkRowText: { fontSize: 13.5, fontWeight: '600', color: colors.brownLight },
  inlineLink: { fontSize: 13, fontWeight: '700', color: colors.brownLight, textDecorationLine: 'underline' },
  emptyText: { fontSize: 13, color: colors.textSoft, lineHeight: 18, padding: 16 },
  tierLine: { fontSize: 12.5, color: colors.textSoft, lineHeight: 18, marginTop: 12 },
  errorNote: {
    fontSize: 13, color: colors.errorText, backgroundColor: colors.errorBg, borderWidth: 1,
    borderColor: colors.errorBorder, borderRadius: 10, padding: 12, marginBottom: 14,
  },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14,
  },
  historyDate: { fontSize: 14, fontWeight: '600', color: colors.text },
  historyMethod: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  historyAmount: { fontSize: 14.5, fontWeight: '700', color: colors.text },

  referralHint: { fontSize: 13, color: colors.textSoft, lineHeight: 18, padding: 18, paddingBottom: 0 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.brownPale, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14, marginHorizontal: 18, marginTop: 14, marginBottom: 14,
    backgroundColor: colors.cream,
  },
  codeText: { fontFamily: MONO_FONT, fontSize: 15, fontWeight: '700', letterSpacing: 0.5, color: colors.brown },

  copyBtn: {
    flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brownPale,
    borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginLeft: 18, marginBottom: 18,
  },
  copyBtnText: { color: colors.brown, fontSize: 13.5, fontWeight: '700' },
  shareBtn: {
    flex: 1, backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 12,
    alignItems: 'center', marginRight: 18, marginBottom: 18,
  },
  shareBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  statTile: {
    flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  statValue: { fontFamily: serif, fontSize: 22, fontWeight: '700', color: colors.brown },
  statLabel: { fontSize: 11, color: colors.textSoft, marginTop: 2 },

  referralRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  referralAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  referralAvatarText: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  referralName: { fontSize: 14, fontWeight: '600', color: colors.text },
  referralDetail: { fontSize: 11.5, color: colors.textSoft, marginTop: 1 },

  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipPositive: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder },
  chipPending: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder },
  chipText: { fontSize: 11, fontWeight: '700' },
  chipTextPositive: { color: colors.successText },
  chipTextPending: { color: colors.errorText },
});
