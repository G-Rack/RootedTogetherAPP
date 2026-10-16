import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Share, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor, ROLE_LABELS } from '../roleLabels';
import ReportBlockMenu from './ReportBlockMenu';
import PostLikersSheet from './PostLikersSheet';
import DoubleTapLike from './DoubleTapLike';
import { likeHaptic } from '../haptics';
import { CONTENT_TYPES } from '../moderationApi';

// One post, laid out like an Instagram feed post: author row, full-width
// image at its own shape, a heart / comment / share row with counts, the
// caption (author name in bold, two lines with "… more"), "View all N
// comments", and the date.
//
// Tapping the heart likes/unlikes; tapping the like COUNT opens a "Likes"
// sheet listing everyone who liked it. Share opens the phone's share sheet.
//
// The card runs edge to edge: the FlatList that holds it is pulled out of
// the app's 24px side padding (marginHorizontal -24) by the screen showing
// it. A negative margin on the card itself gets clipped on Android.
//
// `author` is the post's directory_listing row, resolved by the caller via
// fetchAuthorsByAuthId (keyed off post.author_auth_id).
const SITE_URL = 'https://rootedtogether.club';

function formatPostDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const opts = { month: 'long', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  try {
    return d.toLocaleDateString('en-US', opts);
  } catch (e) {
    return d.toDateString();
  }
}

export default function PostCard({
  post, author, authorAvatarUrl, imageUrl, liked, likeCount, commentCount,
  onToggleLike, onOpenComments, onOpenAuthor, isFollowing, onToggleFollow,
  myAuthId, onReported, onBlocked, onOpenPerson,
}) {
  const verified = author?.vetting_status === 'Approved';
  const { width } = useWindowDimensions();
  const [aspect, setAspect] = useState(1); // width / height
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionTruncatable, setCaptionTruncatable] = useState(false);
  const [showLikers, setShowLikers] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    Image.getSize(
      imageUrl,
      (w, h) => {
        // Same range Instagram allows: 4:5 portrait up to 1.91:1 landscape.
        if (!cancelled && w && h) setAspect(Math.min(1.91, Math.max(0.8, w / h)));
      },
      () => {},
    );
    return () => { cancelled = true; };
  }, [imageUrl]);

  async function handleShare() {
    const name = author?.name || 'Someone';
    const snippet = post.body ? `“${post.body.length > 140 ? `${post.body.slice(0, 140)}…` : post.body}”\n\n` : '';
    try {
      await Share.share({ message: `${name} on Rooted Together\n\n${snippet}${SITE_URL}` });
    } catch (e) {
      // Share sheet dismissed or unavailable — nothing to do.
    }
  }

  const textOnly = !imageUrl;

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
          <View style={{ flexShrink: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.authorName} numberOfLines={1}>{author?.name || 'Unknown'}</Text>
              {verified && <Ionicons name="checkmark-circle" size={14} color={colors.brown} style={styles.verifiedIcon} />}
            </View>
            <Text style={styles.authorRole}>{author?.role ? (ROLE_LABELS[author.role] || author.role) : 'Spiritual Leader'}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.rightActions}>
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
          <ReportBlockMenu
            myAuthId={myAuthId}
            targetAuthId={post.author_auth_id}
            targetName={author?.name}
            contentType={CONTENT_TYPES.post}
            contentId={post.id}
            noun="post"
            onReported={onReported}
            onBlocked={onBlocked}
          />
        </View>
      </View>

      {/* Double-tap anywhere on the picture (or the text card) to like. */}
      {imageUrl ? (
        <DoubleTapLike onDoubleTap={onToggleLike} alreadyActive={liked} style={{ width, height: width / aspect }}>
          <Image source={{ uri: imageUrl }} style={{ width, height: width / aspect, backgroundColor: colors.creamDark }} resizeMode="cover" />
        </DoubleTapLike>
      ) : post.body ? (
        <DoubleTapLike onDoubleTap={onToggleLike} alreadyActive={liked} iconColor="#C0392B">
          <View style={styles.textOnlyBox}>
            <Text style={styles.textOnlyBody}>{post.body}</Text>
          </View>
        </DoubleTapLike>
      ) : null}

      <View style={styles.actionsRow}>
        <View style={styles.actionBtn}>
          <TouchableOpacity onPress={() => { if (!liked) likeHaptic(); onToggleLike(); }} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#C0392B' : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLikers(true)} disabled={!likeCount} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
            <Text style={styles.actionCount}>{likeCount || 0}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={onOpenComments} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          <Text style={styles.actionCount}>{commentCount || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {!textOnly && post.body ? (
        <View style={styles.captionWrap}>
          <Text
            style={[styles.caption, styles.captionMeasure]}
            onTextLayout={(e) => setCaptionTruncatable(e.nativeEvent.lines.length > 2)}
          >
            <Text style={styles.captionName}>{author?.name || ''} </Text>
            {post.body}
          </Text>
          <Text style={styles.caption} numberOfLines={captionExpanded ? undefined : 2}>
            <Text style={styles.captionName}>{author?.name || ''} </Text>
            {post.body}
          </Text>
          {captionTruncatable && !captionExpanded && (
            <TouchableOpacity onPress={() => setCaptionExpanded(true)} hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.moreText}>… more</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {commentCount > 0 && (
        <TouchableOpacity onPress={onOpenComments} activeOpacity={0.7}>
          <Text style={styles.viewComments}>
            {commentCount === 1 ? 'View 1 comment' : `View all ${commentCount} comments`}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.date}>{formatPostDate(post.created_at)}</Text>

      <PostLikersSheet
        postId={post.id}
        visible={showLikers}
        onClose={() => setShowLikers(false)}
        onOpenPerson={onOpenPerson}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, marginBottom: 22 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorTap: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  avatarImg: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.creamDark },
  avatarFallback: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { fontSize: 14.5, color: colors.text, fontWeight: '700', flexShrink: 1 },
  verifiedIcon: { marginLeft: 4 },
  authorRole: { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  followBtn: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 14, overflow: 'visible',
  },
  followBtnActive: { backgroundColor: colors.brown, borderColor: colors.brown },
  followBtnText: { fontSize: 12.5, color: colors.brown, fontWeight: '700' },
  followBtnTextActive: { color: colors.white },
  textOnlyBox: {
    backgroundColor: colors.cream, paddingHorizontal: 22, paddingVertical: 28,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(107,66,38,0.08)',
  },
  textOnlyBody: { fontFamily: serif, fontSize: 17, lineHeight: 25, color: colors.text },
  actionsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, gap: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 14.5, color: colors.text, fontWeight: '600' },
  captionWrap: { paddingHorizontal: 14, position: 'relative' },
  caption: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
  captionMeasure: { position: 'absolute', left: 14, right: 14, top: 0, opacity: 0, zIndex: -1 },
  captionName: { fontWeight: '700' },
  moreText: { fontSize: 14.5, color: colors.textSoft, marginTop: 1 },
  viewComments: { fontSize: 14, color: colors.textSoft, paddingHorizontal: 14, marginTop: 6 },
  date: { fontSize: 12.5, color: colors.textSoft, paddingHorizontal: 14, marginTop: 6 },
});
