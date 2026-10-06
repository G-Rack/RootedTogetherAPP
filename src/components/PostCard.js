import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor, ROLE_LABELS } from '../roleLabels';

// One post in the Explore feed — an image-with-caption or a text-only
// "thread" from a Spiritual Leader (or, since posts aren't actually
// restricted to one role table at the database level, a Mother or Pastor
// too), plus a like button and a comment count. Tapping the author's name/
// photo opens their public profile. A verified checkmark (Approved only)
// and a Follow/Following button next to the author were added to match
// Girik's Explore reference — the button is wired to a real `follows`
// table, not just cosmetic.
//
// `author` is the post's directory_listing row, resolved by the caller via
// fetchAuthorsByAuthId (keyed off post.author_auth_id) — there's no foreign
// key from posts to any role table, so it can't be embedded on `post`
// itself the way an actual FK would allow.
export default function PostCard({
  post, author, authorAvatarUrl, imageUrl, liked, likeCount, commentCount,
  onToggleLike, onOpenComments, onOpenAuthor, isFollowing, onToggleFollow,
}) {
  const verified = author?.vetting_status === 'Approved';

  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <TouchableOpacity style={styles.authorTap} onPress={onOpenAuthor} activeOpacity={0.7}>
          {authorAvatarUrl ? (
            <Image source={{ uri: authorAvatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initialsFor(author?.name)}</Text>
            </View>
          )}
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.authorName}>{author?.name || 'Unknown'}</Text>
              {verified && <Ionicons name="checkmark-circle" size={14} color={colors.brown} style={styles.verifiedIcon} />}
            </View>
            <Text style={styles.authorRole}>{author?.role ? (ROLE_LABELS[author.role] || author.role) : 'Spiritual Leader'}</Text>
          </View>
        </TouchableOpacity>

        {onToggleFollow && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={onToggleFollow}
            activeOpacity={0.75}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.postImage} /> : null}

      {post.body ? (
        <Text style={[styles.body, !imageUrl && styles.bodyStandalone]}>{post.body}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onToggleLike} activeOpacity={0.7}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.brown : colors.textSoft} />
          <Text style={styles.actionCount}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onOpenComments} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSoft} />
          <Text style={styles.actionCount}>{commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  avatarImg: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.creamDark },
  avatarFallback: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { fontSize: 14.5, color: colors.text, fontWeight: '700' },
  verifiedIcon: { marginLeft: 4 },
  authorRole: { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  followBtn: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 14, overflow: 'visible',
  },
  followBtnActive: { backgroundColor: colors.brown, borderColor: colors.brown },
  followBtnText: { fontSize: 12.5, color: colors.brown, fontWeight: '700' },
  followBtnTextActive: { color: colors.white },
  postImage: { width: '100%', height: 340, backgroundColor: colors.creamDark },
  body: { fontSize: 14.5, color: colors.text, lineHeight: 21, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  bodyStandalone: { fontFamily: serif, fontSize: 17, lineHeight: 25, paddingVertical: 16 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 13.5, color: colors.textSoft, fontWeight: '600' },
});
