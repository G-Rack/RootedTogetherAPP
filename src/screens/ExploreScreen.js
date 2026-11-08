import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import PostCard from '../components/PostCard';
import FinishProfileCard from '../components/FinishProfileCard';
import CommunityPostCard from '../components/CommunityPostCard';
import StoriesRow from '../components/StoriesRow';
import StoryViewer from '../components/StoryViewer';
import CameraPage from '../components/CameraPage';
import {
  fetchPosts, fetchSignedUrls, fetchLikeMeta, fetchCommentCounts, toggleLike, getMyLeaderRow,
  fetchFollowMeta, followPerson, unfollowPerson, fetchAuthorsByAuthId, fetchActiveStories,
} from '../postsApi';
import {
  fetchMyCommunities, fetchCommunityPostsForCommunities, fetchHelpfulMeta, setHelpful,
  fetchCommentCounts as fetchCommunityCommentCounts,
} from '../communitiesApi';

// The Explore tab — an Instagram/Threads-style feed of posts from
// Spiritual Leaders, Mothers, and Pastors, now with posts from the
// communities you've joined mixed in too (per Girik's instruction that
// Communities should surface through Explore and profiles rather than
// living on its own bottom tab). Everyone logged in can view, like, and
// comment; only an Approved Spiritual Leader, Mother, or Pastor sees the
// camera page, reached by swiping the feed sideways (or tapping the camera
// icon up top), where they choose a Story or a Post. A small leaf icon up top opens the full Communities
// directory (search/browse/create) — the only other entry point besides
// someone's profile.
export default function ExploreScreen({
  session, onOpenAuthor, onOpenComments, onCreatePost, onCreateStory, onSearchPeople,
  onOpenCommunity, onOpenCommunityComments, onBrowseCommunities, onOpenChecklist,
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
  const [storyGroups, setStoryGroups] = useState([]);
  const [storyImages, setStoryImages] = useState({});
  const [me, setMe] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const pagerRef = useRef(null);
  const pagerStarted = useRef(false);

  const myAuthId = session?.user?.id;

  // Story circles: me first, then people I follow, then everyone else with
  // an active story. Never lets a story problem break the feed.
  const loadStories = useCallback(async () => {
    try {
      const rows = await fetchActiveStories();
      const ids = [...new Set([...rows.map((r) => r.author_auth_id), myAuthId].filter(Boolean))];
      const [authors, follows] = await Promise.all([
        fetchAuthorsByAuthId(ids),
        fetchFollowMeta(ids.filter((id) => id !== myAuthId), myAuthId),
      ]);
      const [imgs, avs] = await Promise.all([
        fetchSignedUrls('post-images', rows.map((r) => r.image_path)),
        fetchSignedUrls('profile-pictures', Object.values(authors).map((a) => a.profile_picture_path)),
      ]);
      const byAuthor = {};
      rows.forEach((r) => { (byAuthor[r.author_auth_id] = byAuthor[r.author_auth_id] || []).push(r); });
      const groups = Object.keys(byAuthor).map((id) => {
        const a = authors[id];
        const list = byAuthor[id];
        return {
          authorId: id,
          name: a ? a.name : null,
          avatarUrl: a && a.profile_picture_path ? avs[a.profile_picture_path] || null : null,
          stories: list,
          isMe: id === myAuthId,
          latest: new Date(list[list.length - 1].created_at).getTime(),
          followed: !!(follows[id] && follows[id].followedByMe),
        };
      });
      groups.sort((x, y) => {
        if (x.isMe !== y.isMe) return x.isMe ? -1 : 1;
        if (x.followed !== y.followed) return x.followed ? -1 : 1;
        return y.latest - x.latest;
      });
      const mine = authors[myAuthId];
      setMe({
        name: mine ? mine.name : null,
        avatarUrl: mine && mine.profile_picture_path ? avs[mine.profile_picture_path] || null : null,
      });
      setStoryImages(imgs);
      setStoryGroups(groups);
    } catch (e) {
      // Stories are a nice-to-have on this screen; stay quiet if they fail.
    }
  }, [myAuthId]);

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
      await loadStories();
    } catch (e) {
      setError('Couldn’t load Explore right now. Pull down to try again.');
      setFeed([]);
    }
  }, [myAuthId, loadStories]);

  useEffect(() => {
    load();
  }, [load]);

  // Start on the feed page (the camera page sits to its left).
  useEffect(() => {
    if (canPost && box.w > 0 && !pagerStarted.current) {
      pagerStarted.current = true;
      setTimeout(() => { pagerRef.current && pagerRef.current.scrollTo({ x: box.w, y: 0, animated: false }); }, 0);
    }
  }, [canPost, box.w]);

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

  // Heart updates instantly; server calls go one at a time per post as an
  // explicit on/off, so fast taps can't cross over and un-like the post.
  const helpfulRef = useRef({});
  helpfulRef.current = communityHelpfulMeta;
  const helpfulQueue = useRef({});

  function handleToggleHelpful(postId) {
    const current = helpfulRef.current[postId] || { count: 0, helpfulByMe: false };
    const want = !current.helpfulByMe;
    const next = { count: Math.max(0, current.count + (want ? 1 : -1)), helpfulByMe: want };
    helpfulRef.current = { ...helpfulRef.current, [postId]: next };
    setCommunityHelpfulMeta(helpfulRef.current);
    const prev = helpfulQueue.current[postId] || Promise.resolve();
    helpfulQueue.current[postId] = prev
      .then(() => setHelpful(postId, myAuthId, want))
      .catch(async () => {
        try {
          const fresh = await fetchHelpfulMeta([postId], myAuthId);
          helpfulRef.current = { ...helpfulRef.current, [postId]: fresh[postId] };
          setCommunityHelpfulMeta(helpfulRef.current);
        } catch (e) { /* leave as is */ }
      });
  }

  if (feed === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  const feedBody = (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Explore</Text>
        <View style={styles.headerActions}>
          {canPost && (
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => pagerRef.current && pagerRef.current.scrollTo({ x: 0, y: 0, animated: true })}
              activeOpacity={0.7}
              accessibilityLabel="Open camera to add a story or post"
            >
              <Ionicons name="camera-outline" size={19} color={colors.brown} />
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

      {onOpenChecklist ? <FinishProfileCard session={session} onPress={onOpenChecklist} /> : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        style={styles.feedList}
        data={feed}
        ListHeaderComponent={
          <StoriesRow
            groups={storyGroups}
            me={me}
            canPost={canPost}
            onAdd={() => pagerRef.current && pagerRef.current.scrollTo({ x: 0, y: 0, animated: true })}
            onOpenGroup={(i) => setViewerIndex(i)}
          />
        }
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
              <View style={styles.insetItem}>
              <CommunityPostCard
                post={post}
                author={communityAuthors[post.author_auth_id]}
                community={community}
                helpful={communityHelpfulMeta[post.id]}
                commentCount={communityCommentCounts[post.id] || 0}
                onToggleHelpful={() => handleToggleHelpful(post.id)}
                onOpenComments={() => onOpenCommunityComments(post.id)}
                onOpenCommunity={() => onOpenCommunity(post.community_id)}
                myAuthId={myAuthId}
                onReported={() => setFeed((f) => f.filter((x) => x.id !== item.id))}
                onBlocked={load}
              />
              </View>
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
              onOpenPerson={(p) => onOpenAuthor(p.role, p.id)}
              isFollowing={!!followMeta[authorAuthId]?.followedByMe}
              onToggleFollow={authorAuthId && authorAuthId !== myAuthId ? () => handleToggleFollow(authorAuthId) : undefined}
              myAuthId={myAuthId}
              onReported={() => setFeed((f) => f.filter((x) => x.id !== item.id))}
              onBlocked={load}
            />
          );
        }}
      />
    </>
  );

  const viewer = (
    <StoryViewer
      visible={viewerIndex !== null}
      groups={storyGroups}
      startIndex={viewerIndex || 0}
      imageUrls={storyImages}
      myAuthId={myAuthId}
      onClose={() => setViewerIndex(null)}
      onDeleted={() => { setViewerIndex(null); loadStories(); }}
      onHideAuthor={(id) => { setViewerIndex(null); setStoryGroups((g) => g.filter((x) => x.authorId !== id)); }}
      onBlocked={() => { setViewerIndex(null); load(); }}
    />
  );

  // Only people who can post get the sideways camera page.
  if (!canPost) {
    return (
      <View style={styles.wrap}>
        {feedBody}
        {viewer}
      </View>
    );
  }

  return (
    <View
      style={styles.pagerBox}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 ? (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          style={{ flex: 1 }}
          contentOffset={{ x: box.w, y: 0 }}
        >
          <View style={{ width: box.w, height: box.h }}>
            <CameraPage
              onPicked={(mode, image) => (mode === 'story' ? onCreateStory(image) : onCreatePost(image))}
              onTextPost={() => onCreatePost(null)}
            />
          </View>
          <View style={{ width: box.w, height: box.h, paddingHorizontal: 24, paddingTop: 4 }}>
            {feedBody}
          </View>
        </ScrollView>
      ) : null}
      {viewer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 4 },
  // The sideways pager runs edge to edge, so it breaks out of the app's 24px
  // side padding; the feed page puts that padding back inside.
  pagerBox: { flex: 1, marginHorizontal: -24 },
  // Posts run edge to edge, so the feed list is pulled out of the app's
  // 24px side padding; community cards are put back inside it.
  feedList: { marginHorizontal: -24 },
  insetItem: { paddingHorizontal: 24 },
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
