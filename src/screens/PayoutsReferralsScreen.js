import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Share, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { handleFor } from '../roleLabels';

// Replaces the old "Payouts & Earnings" stub in Settings for Leader roles
// (Mothers, Pastors, Influencers). There is no payouts/referrals backend
// yet, so every number here is a placeholder — this screen exists to give
// the real layout and interactions a home, the same way ChangePasswordScreen
// replaced its own "coming later" stub. Once a payouts/referrals table and
// Edge Function exist, swap the constants below for a real fetch.
//
// The referral code itself isn't a placeholder, though — it's derived from
// the signed-in person's own @handle (the same handleFor() used for their
// profile's @handle text), so each leader sees and shares their own code
// rather than a shared dummy one.
//
// Request Payout mirrors the app's existing "coming in a later part of the
// build" pattern (see ProfileScreen's notReady helper) rather than silently
// doing nothing. Copy Code and Share Link use React Native's built-in Share
// API rather than a clipboard library — nothing else in this app depends on
// one yet, and the native share sheet on both iOS and Android already
// includes a Copy action, so this works today with no new dependency.
const REFERRAL_URL = 'https://rootedtogether.club';

const PAYOUT_HISTORY = [
  { date: 'Sep 28, 2026', method: 'Bank transfer', amount: '$210.00', status: 'Paid' },
  { date: 'Sep 14, 2026', method: 'Bank transfer', amount: '$185.00', status: 'Paid' },
  { date: 'Aug 30, 2026', method: 'Bank transfer', amount: '$140.00', status: 'Processing' },
];

const REFERRALS = [
  { initial: 'M', name: 'Maria T.', detail: 'Joined Sep 20, 2026', status: 'Earning' },
  { initial: 'S', name: 'Sarah P.', detail: 'Joined Sep 10, 2026', status: 'Earning' },
  { initial: 'D', name: 'Daniel K.', detail: 'Invited Sep 25, 2026', status: 'Pending' },
  { initial: 'J', name: 'James O.', detail: 'Invited Oct 1, 2026', status: 'Pending' },
];

function StatusChip({ status }) {
  const isPositive = status === 'Paid' || status === 'Earning';
  return (
    <View style={[styles.chip, isPositive ? styles.chipPositive : styles.chipPending]}>
      <Text style={[styles.chipText, isPositive ? styles.chipTextPositive : styles.chipTextPending]}>
        {status}
      </Text>
    </View>
  );
}

export default function PayoutsReferralsScreen({ onBack, person }) {
  // handleFor() always returns "@slug" (or "@member" with no name) — strip
  // the "@" and upper-case it so the code reads like "ROOTED-ZEEPOMBO"
  // rather than "ROOTED-@zeepombo".
  const referralCode = `ROOTED-${handleFor(person?.name).slice(1).toUpperCase()}`;

  function handleRequestPayout() {
    Alert.alert('Request Payout', 'Payout requests aren’t available yet — this is coming in a later part of the build.');
  }

  async function handleCopyCode() {
    try {
      await Share.share({ message: referralCode });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  async function handleShareLink() {
    try {
      await Share.share({
        message: `Join me on Rooted Together — use my invite code ${referralCode} or sign up at ${REFERRAL_URL}`,
      });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Payouts & Referrals</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.wrap}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 }}
      >
        {/* Balance hero card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>$482.00</Text>

          <View style={styles.balanceRow}>
            <View style={{ paddingTop: 12, marginRight: 18 }}>
              <Text style={styles.balanceSubLabel}>Pending</Text>
              <Text style={styles.balanceSubValue}>$120.00</Text>
            </View>
            <View style={{ paddingTop: 12 }}>
              <Text style={styles.balanceSubLabel}>Lifetime earned</Text>
              <Text style={styles.balanceSubValue}>$2,340.00</Text>
            </View>
          </View>

          <Text style={styles.balanceNote}>Includes $140.00 from referrals this month</Text>

          <TouchableOpacity style={styles.payoutBtn} onPress={handleRequestPayout} activeOpacity={0.85}>
            <Text style={styles.payoutBtnText}>Request Payout</Text>
          </TouchableOpacity>
        </View>

        {/* Payout history */}
        <Text style={styles.sectionLabel}>Payout History</Text>
        <View style={styles.card}>
          {PAYOUT_HISTORY.map((row, i) => (
            <View
              key={row.date}
              style={[styles.historyRow, i < PAYOUT_HISTORY.length - 1 && styles.rowBorder]}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.historyDate}>{row.date}</Text>
                <Text style={styles.historyMethod}>{row.method}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusChip status={row.status} />
                <Text style={styles.historyAmount}>{row.amount}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Referral link */}
        <Text style={styles.sectionLabel}>Your Referral Link</Text>
        <View style={styles.card}>
          <Text style={styles.referralHint}>
            Share your link — when someone joins and becomes active, you both earn.
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
        </View>

        {/* Referral stats */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Invited</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>7</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>4</Text>
            <Text style={styles.statLabel}>Earning</Text>
          </View>
        </View>

        {/* Referral list */}
        <Text style={styles.sectionLabel}>Your Referrals</Text>
        <View style={styles.card}>
          {REFERRALS.map((r, i) => (
            <View
              key={r.name}
              style={[styles.referralRow, i < REFERRALS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.referralAvatar}>
                <Text style={styles.referralAvatarText}>{r.initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralName}>{r.name}</Text>
                <Text style={styles.referralDetail}>{r.detail}</Text>
              </View>
              <StatusChip status={r.status} />
            </View>
          ))}
        </View>
      </ScrollView>
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
