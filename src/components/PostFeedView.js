import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import PostCard from './PostCard';
import PostCommentsScreen from '../screens/PostCommentsScreen';
import { fetchLikeMeta, fetchCommentCounts, toggleLike } from '../postsApi';

// Instagram-style "Posts" view a profile grid opens into: one person's posts
// at full size, scrolled to the one that was tapped. Likes, the "Likes"
// sheet, share and comments all work here; comments open inside this view
// so Back returns to the same post rather than all the way to the grid.
export default function PostFeedView({
  session, posts, startPostId, author, authorAvatarUrl, imageUrls,
  onBack, onOpenPerson, onPostRemoved, onBlocked,
}) {
  const myAuthId = session?.user?.id;
  const listRef = useRef(null);
  const [likeMeta, setLikeMeta] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [commentsPostId, setCommentsPostId] = useState(null);
  // The post to open on: the tapped one at first, then whichever post's
  // comments you just came back from.
  const [anchorId, setAnchorId] = useState(startPostId);
  const startIndex = Math.max(0, posts.findIndex((p) => p.id === anchorId));
  const [positioned, setPositioned] = useState(startIndex === 0);

  function jumpTo(y) {
    listRef.current?.scrollToOffset({ offset: y, animated: false });
    // One frame for the scroll to apply before the list is shown.
    requestAnimationFrame(() => setPositioned(true));
  }

  const loadMeta = useCallback(async () => {
    const ids = posts.map((p) => p.id);
    try {
      const [likes, counts] = await Promise.all([fetchLikeMeta(ids, myAuthId), fetchCommentCounts(ids)]);
      setLikeMeta(likes);
      setCommentCounts(counts);
    } catch (e) {
      // Counts just stay at zero; the posts themselves still show.
    }
  }, [posts, myAuthId]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  async function handleToggleLike(postId) {
    const current = likeMeta[postId] || { count: 0, likedByMe: false };
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

  if (commentsPostId) {
    return (
      <PostCommentsScreen
        postId={commentsPostId}
        session={session}
        onBack={() => {
          setAnchorId(commentsPostId);
          setPositioned(false);
          setCommentsPostId(null);
          loadMeta();
        }}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Posts</Text>
      </View>
      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={(item) => item.id}
        // Posts vary in height, so FlatList can't jump straight to the tapped
        // one (initialScrollIndex left the screen blank until you scrolled).
        // Instead, render every post up to it, measure where it lands, scroll
        // there, and keep the list hidden until it's in place.
        initialNumToRender={startIndex + 3}
        style={[styles.list, !positioned && styles.hidden]}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item, index }) => {
          const meta = likeMeta[item.id] || { count: 0, likedByMe: false };
          return (
            <View onLayout={index === startIndex && !positioned ? (e) => jumpTo(e.nativeEvent.layout.y) : undefined}>
            <PostCard
              post={item}
              author={author}
              imageUrl={item.image_path ? imageUrls[item.image_path] : null}
              authorAvatarUrl={authorAvatarUrl}
              liked={meta.likedByMe}
              likeCount={meta.count}
              commentCount={commentCounts[item.id] || 0}
              onToggleLike={() => handleToggleLike(item.id)}
              onOpenComments={() => setCommentsPostId(item.id)}
              onOpenAuthor={onBack}
              onOpenPerson={onOpenPerson}
              myAuthId={myAuthId}
              onReported={() => onPostRemoved?.(item.id)}
              onBlocked={onBlocked}
            />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  list: { marginHorizontal: -24 },
  hidden: { opacity: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingBottom: 12 },
  backBtn: { paddingVertical: 2 },
  title: { fontFamily: serif, fontSize: 19, fontWeight: '700', color: colors.text },
});
