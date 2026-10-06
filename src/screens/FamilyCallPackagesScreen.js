import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';

// An honest "coming soon" placeholder for 1:1 call packages, reached from
// "Request a 1:1 Call" on a Mother/Pastor's family page. This is
// deliberately NOT the pricing-card purchase flow from
// FamilyCallPackages.dc.html — per Girik's explicit call this round
// ("Skip for this round"), there's no real payment processor wired up yet,
// so rather than fake-unlocking it the way Chat's Premium gate does, this
// stays a plain placeholder until real billing exists.
export default function FamilyCallPackagesScreen({ leaderName, onBack }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.brown} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>1:1 Call Packages</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Ionicons name="call-outline" size={28} color={colors.brown} />
        </View>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.subtitle}>
          {leaderName
            ? `Booking private calls with ${leaderName} isn't live yet — this needs real payment processing behind it first.`
            : "Booking private calls isn't live yet — this needs real payment processing behind it first."}
        </Text>
        <Text style={styles.footnote}>Everything else in your Spiritual Family — the mind map, weekly shares, and practices — is real and ready to use today.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  headerBtn: { width: 32, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 16, color: colors.brown, fontWeight: '700' },
  body: { alignItems: 'center', paddingTop: 44, paddingHorizontal: 12 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontFamily: serif, fontSize: 19, color: colors.brown, fontWeight: '700' },
  subtitle: { fontSize: 13.5, color: colors.textSoft, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  footnote: { fontSize: 12, color: colors.textSoft, textAlign: 'center', lineHeight: 18, marginTop: 22 },
});
