import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { initialsFor, ROLE_LABELS } from '../roleLabels';

// One community post — used both inside a community (CommunityDetailScreen,
// where the community is already obvious from context) and mixed into the
// Explore feed (ExploreScreen, where a `community` badge is shown so it's
// clear which community a post came from and tapping it jumps there).
// Deliberately a separate card from PostCard: no image, no Follow button,
// and a "Helpful" leaf icon instead of a heart — matches Girik's ask that a
// community post's like button read as "this added value" rather than a
// generic like.
export default function CommunityPostCard({
  post, author, community, helpful, commentCount, onToggleHelpful, onOpenComments, onOpenCommunity, style,
}) {
  return (
    <View style={[styles.card, style]}>
      {community ? (
        <TouchableOpacity style={styles.communityBadge} onPress={onOpenCommunity} activeOpacity={0.7}>
          <Text style={styles.communityBadgeIcon}>{community.icon}</Text>
          <Text style={styles.communityBadgeText}>{community.name}</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.authorRow}>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{initialsFor(author?.name)}</Text>
        </View>
        <View>
          <Text style={styles.authorName}>{author?.name || 'Someone'}</Text>
          <Text style={styles.authorRole}>{author ? (ROLE_LABELS[author.role] || author.role) : ''}</Text>
        </View>
      </View>
      <Text style={styles.body}>{post.body}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleHelpful} activeOpacity={0.7}>
          <Ionicons
            name={helpful?.helpfulByMe ? 'leaf' : 'leaf-outline'}
            size={18}
            color={helpful?.helpfulByMe ? colors.successText : colors.textSoft}
          />
          <Text style={[styles.actionCount, helpful?.helpfulByMe && styles.actionCountActive]}>
            Helpful · {helpful?.count || 0}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onOpenComments} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSoft} />
          <Text style={styles.actionCount}>{commentCount || 0}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 12, marginBottom: 14, padding: 12,
  },
  communityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.creamDark, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10,
    overflow: 'visible',
  },
  communityBadgeIcon: { fontSize: 13 },
  communityBadgeText: { fontSize: 11.5, color: colors.brown, fontWeight: '700' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarFallback: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 12 },
  authorName: { fontSize: 13.5, color: colors.text, fontWeight: '700' },
  authorRole: { fontSize: 11, color: colors.textSoft, marginTop: 1 },
  body: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 12.5, color: colors.textSoft, fontWeight: '600' },
  actionCountActive: { color: colors.brown },
});
