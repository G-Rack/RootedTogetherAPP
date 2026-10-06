import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, serif } from '../theme';

// Reusable placeholder for tabs whose real build phase hasn't happened yet
// (Explore, Chat, Spiritual Family). Keeps HomeTabs honest about what's
// actually built versus what's just reserved layout for later.
export default function ComingSoonScreen({ icon, title, body }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 12 },
  icon: { fontSize: 36, marginBottom: 14 },
  title: { fontFamily: serif, fontSize: 20, color: colors.brown, marginBottom: 8, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14.5, color: colors.textSoft, textAlign: 'center', lineHeight: 21 },
});
