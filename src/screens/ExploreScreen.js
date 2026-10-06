import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import PostCard from '../components/PostCard';
import CommunityPostCard from '../components/CommunityPostCard';
import {
  fetchPosts, fetchSignedUrls, fetchLikeMeta, fetchCommentCounts, toggleLike, getMyLeaderRow,
  fetchFollowMeta, followPerson, unfollowPerson, fetchAuthorsByAuthId,
} from '../postsApi';
import {
  fetchMyCommunities, fetchCommunityPostsForCommunities, fetchHelpfulMeta, toggleHelpful,
  fetchCommentCounts as fetchCommunityCommentCounts,
} from '../communitiesApi';

// The Explore tab — an Instagram/Threads-style feed of posts from
// Spiritual Leaders, Mothers, and Pastors, now with posts from the
// communities you've joined mixed in too (per Girik's instruction that
// Communities should surface through Explore and profiles rather than
// living on its own bottom tab). Everyone logged in can view, like, and
// comment; only an Approved Spiritual Leader, Mother, or Pastor sees the
// "+ New Post" button. A small leaf icon up top opens the full Communities
// directory (search/browse/create) — the only other entry point besides
// someone's profile.
export default function ExploreScreen({
  session, onOpenAuthor, onOpenComments, onCreatePost, onSearchPeople,
  onOpenCommunity, onOpenCommunityComments, onBrowseCommunities,
}) {
  const [feed, setFeed] = useState(null); // null = loading; array of {kind:'leader'|'community', post, ...}
  const [imageUrls, setImageUrls] = useState({});
  const [avatarUrls, setAvatarUrls] = useState({});
  const [leaderAuthors, setLeaderAuthors] = useState({}); // { [author_auth_id]: directory_listing row }
  const [likeMeta, setLikeMeta] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [followMeta, setFollowMeta] = useState({});
  const [communityAuthors, setCommunityAuthors] = useState({});
  const [communityHelpfulMeta, setCommunityHelpfulMeta] = useState({});
  const [communityCommentCounts, setCommunityCommentCounts] = useState({});
  const [communitiesById, setCommunitiesById] = useState({});
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [canPost, setCanPost] = useState(false);

  const myAuthId = session?.user?.id;

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchPosts();

      const postImagePaths = data.map((p) => p.image_path).filter(Boolean);
      // There's no FK from posts to any role table (and an author isn't
      // always an influencer — a Mother or Pastor's auth id can show up
      // here too), so authors are resolved afterwards via directory_listing
      // — the same role-agnostic lookup community posts already use below —
      // instead of trying to embed them in fetchPosts() itself.
      const authorAuthIds = data.map((p) => p.author_auth_id).filter(Boolean);

      const myCommunities = await fetchMyCommunities(myAuthId);
      const communityMap = {};
      myCommunities.forEach((c) => { communityMap[c.id] = c; });
      const communityPosts = await fetchCommunityPostsForCommunities(myCommunities.map((c) => c.id));

      const [
        likes, comments, myLeaderRow, follows,
        lAuthors, cAuthors, cHelpful, cComments,
      ] = await Promise.all([
        fetchLikeMeta(data.map((p) => p.id), myAuthId),
        fetchCommentCounts(data.map((p) => p.id)),
        getMyLeaderRow(myAuthId),
        fetchFollowMeta(authorAuthIds, myAuthId),
        fetchAuthorsByAuthId(authorAuthIds),
        fetchAuthorsByAuthId(communityPosts.map((p) => p.author_auth_id)),
        fetchHelpfulMeta(communityPosts.map((p) => p.id), myAuthId),
        fetchCommunityCommentCounts(communityPosts.map((p) => p.id)),
      ]);

      const avatarPaths = Object.values(lAuthors).map((a) => a.profile_picture_path).filter(Boolean);
      const [images, avatars] = await Promise.all([
        fetchSignedUrls('post-images', postImagePaths),
        fetchSignedUrls('profile-pictures', avatarPaths),
      ]);

      const leaderItems = data.map((p) => ({ kind: 'leader', id: `leader-${p.id}`, post: p, createdAt: p.created_at }));
      const communityItems = communityPosts.map((p) => ({ kind: 'community', id: `community-${p.id}`, post: p, createdAt: p.created_at }));
      const merged = [...leaderItems, ...communityItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setFeed(merged);
      setImageUrls(images);
      setAvatarUrls(avatars);
      setLeaderAuthors(lAuthors);
      setLikeMeta(likes);
      setCommentCounts(comments);
      setCanPost(!!myLeaderRow && myLeaderRow.vetting_status === 'Approved');
      setFollowMeta(follows);
      setCommunityAuthors(cAuthors);
      setCommunityHelpfulMeta(cHelpful);
      setCommunityCommentCounts(cComments);
      setCommunitiesById(communityMap);
    } catch (e) {
      setError('Couldn’t load Explore right now. Pull down to try again.');
      setFeed([]);
    }
  }, [myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleToggleLike(postId) {
    const current = likeMeta[postId] || { count: 0, likedByMe: false };
    // Optimistic update — feels instant, and a failure just gets corrected
    // on the next pull-to-refresh rather than blocking the tap.
    setLikeMeta((m) => ({
      ...m,
      [postId]: { count: current.count + (current.likedByMe ? -1 : 1), likedByMe: !current.likedByMe },
    }));
    try {
      await toggleLike(postId, myAuthId, current.likedByMe);
    } catch (e) {
      setLikeMeta((m) => ({ ...m, [postId]: current }));
    }
  }

  async function handleToggleFollow(authorAuthId) {
    if (!authorAuthId) return;
    const wasFollowing = !!followMeta[authorAuthId]?.followedByMe;
    setFollowMeta((m) => ({ ...m, [authorAuthId]: { followedByMe: !wasFollowing } }));
    try {
      if (wasFollowing) {
        await unfollowPerson(myAuthId, authorAuthId);
      } else {
        await followPerson(myAuthId, authorAuthId);
      }
    } catch (e) {
      setFollowMeta((m) => ({ ...m, [authorAuthId]: { followedByMe: wasFollowing } }));
    }
  }

  async function handleToggleHelpful(postId) {
    const current = communityHelpfulMeta[postId] || { count: 0, helpfulByMe: false };
    setCommunityHelpfulMeta((m) => ({
      ...m,
      [postId]: { count: current.count + (current.helpfulByMe ? -1 : 1), helpfulByMe: !current.helpfulByMe },
    }));
    try {
      await toggleHelpful(postId, myAuthId, current.helpfulByMe);
    } catch (e) {
      setCommunityHelpfulMeta((m) => ({ ...m, [postId]: current }));
    }
  }

  if (feed === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Explore</Text>
        <View style={styles.headerActions}>
          {canPost && (
            <TouchableOpacity style={styles.newPostBtn} onPress={onCreatePost}>
              <Text style={styles.newPostBtnText}>+ New Post</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.searchBtn} onPress={onBrowseCommunities} activeOpacity={0.7}>
            <Ionicons name="leaf-outline" size={18} color={colors.brown} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={onSearchPeople} activeOpacity={0.7}>
            <Ionicons name="search" size={18} color={colors.brown} />
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brown} />}
        ListEmptyComponent={
          !error ? <Text style={styles.emptyText}>No posts yet — check back soon.</Text> : null
        }
        contentContainerStyle={feed.length === 0 ? { flexGrow: 1 } : { paddingBottom: 12 }}
        renderItem={({ item }) => {
          if (item.kind === 'community') {
            const post = item.post;
            const community = communitiesById[post.community_id];
            return (
              <CommunityPostCard
                post={post}
                author={communityAuthors[post.author_auth_id]}
                community={community}
                helpful={communityHelpfulMeta[post.id]}
                commentCount={communityCommentCounts[post.id] || 0}
                onToggleHelpful={() => handleToggleHelpful(post.id)}
                onOpenComments={() => onOpenCommunityComments(post.id)}
                onOpenCommunity={() => onOpenCommunity(post.community_id)}
              />
            );
          }
          const post = item.post;
          const meta = likeMeta[post.id] || { count: 0, likedByMe: false };
          const authorAuthId = post.author_auth_id;
          const author = leaderAuthors[authorAuthId];
          return (
            <PostCard
              post={post}
              author={author}
              imageUrl={post.image_path ? imageUrls[post.image_path] : null}
              authorAvatarUrl={author?.profile_picture_path ? avatarUrls[author.profile_picture_path] : null}
              liked={meta.likedByMe}
              likeCount={meta.count}
              commentCount={commentCounts[post.id] || 0}
              onToggleLike={() => handleToggleLike(post.id)}
              onOpenComments={() => onOpenComments(post.id)}
              onOpenAuthor={() => author && onOpenAuthor(author.role, author.id)}
              isFollowing={!!followMeta[authorAuthId]?.followedByMe}
              onToggleFollow={authorAuthId && authorAuthId !== myAuthId ? () => handleToggleFollow(authorAuthId) : undefined}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  header: { fontFamily: serif, fontSize: 26, color: colors.brown, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  newPostBtn: {
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, overflow: 'visible',
  },
  newPostBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  searchBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 40 },
});
