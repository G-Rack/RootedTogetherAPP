import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '../theme';

// Instagram-style profile grid cell: 3 columns that run edge to edge,
// hairline gaps and square tiles. Used by both the
// user's own ProfileScreen and other people's PublicProfileScreen.
//
// The screens sit inside App's 24px side padding. While the grid is showing,
// the screen's FlatList itself bleeds out to the screen edges
// (gridBleedListStyle) and re-pads its header (gridHeaderPad), so the cells
// can be exactly a third of the screen width each.
export const GRID_GAP = 2;
export const GRID_SIDE_BLEED = 24;

export const postGridRowStyle = { gap: GRID_GAP, marginBottom: GRID_GAP };
export const gridBleedListStyle = { marginHorizontal: -GRID_SIDE_BLEED };
export const gridHeaderPad = { paddingHorizontal: GRID_SIDE_BLEED };

export default function PostGridCell({ post, imageUrl, onPress }) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - GRID_GAP * 2) / 3;
  // Square tiles, like Instagram's classic grid: square posts fill them
  // exactly and every tile is fully covered (no background bars). Tapping
  // a post shows the whole image at its own shape.
  const cellHeight = cellWidth;
  return (
    <TouchableOpacity
      style={[styles.cell, { width: cellWidth, height: cellHeight }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {post.image_path && imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.img} resizeMode="cover" />
      ) : (
        <View style={styles.textCell}>
          <Text style={styles.textBody} numberOfLines={6}>{post.body}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: { backgroundColor: colors.creamDark, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  textCell: { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  textBody: { fontSize: 12, lineHeight: 16, color: colors.text, textAlign: 'center' },
});
