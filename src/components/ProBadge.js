import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Gold "Rooted Pro" pill, matching the badge on the website. `large` is for
// profile screens, the default small size is for list rows.
export default function ProBadge({ large = false, label, style }) {
  const text = label || (large ? 'ROOTED PRO' : 'PRO');
  return (
    <View style={[styles.pill, large && styles.pillLarge, style]}>
      <Text style={[styles.text, large && styles.textLarge]} allowFontScaling={false}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { backgroundColor: '#C8923F', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, alignSelf: 'center' },
  pillLarge: { paddingVertical: 5, paddingHorizontal: 14 },
  text: { fontSize: 9.5, color: '#2E1B10', fontWeight: '800', letterSpacing: 0.5 },
  textLarge: { fontSize: 11, letterSpacing: 0.8 },
});
