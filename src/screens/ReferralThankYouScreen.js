import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, serif } from '../theme';

// Shown after every sign-up, for every role — no "back to start" link,
// just an "Explore the app" button.
//
// `referralCode` is still accepted (the backend generates one for every
// sign-up regardless) but intentionally not displayed yet — the referral
// section is coming back once there's a proper referral feature built
// into the app itself. Keeping the prop here makes that a one-line
// re-add later instead of re-threading it through App.js.
//
// `needsEmailConfirmation` is true when App.js's post-signup auto-login
// came back "Email not confirmed" — only possible once this project's
// Supabase "Confirm email" setting is turned on. In that case there's no
// session yet, so this screen says so plainly and sends the person to Log
// in (once they've tapped the confirmation link in their email) instead of
// implying they can explore right away.
export default function ReferralThankYouScreen({ thankYou, onExplore, needsEmailConfirmation }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{needsEmailConfirmation ? '✉️' : thankYou.icon}</Text>
      <Text style={styles.title}>{needsEmailConfirmation ? 'Check your email' : thankYou.title}</Text>
      <Text style={styles.body}>
        {needsEmailConfirmation
          ? 'Your account is created — we just need to confirm it’s really you. Open the confirmation email we sent you and tap the link, then come back here and log in.'
          : thankYou.body}
      </Text>

      <TouchableOpacity style={styles.exploreBtn} onPress={onExplore}>
        <Text style={styles.exploreBtnText}>{needsEmailConfirmation ? 'Got it — take me to log in' : 'Explore the app'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20 },
  icon: { fontSize: 40, marginBottom: 16 },
  title: { fontFamily: serif, fontSize: 26, color: colors.brown, marginBottom: 8, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15.5, color: colors.textSoft, textAlign: 'center' },
  exploreBtn: {
    marginTop: 28,
    backgroundColor: colors.brown,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
  },
  exploreBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
