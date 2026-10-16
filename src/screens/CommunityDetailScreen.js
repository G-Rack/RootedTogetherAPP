import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { decode } from 'base64-arraybuffer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import { fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';
import CommunityPostCard from '../components/CommunityPostCard';
import ImagePickerField from '../components/ImagePickerField';
import {
  fetchCommunity, fetchCommunityPosts, joinCommunity, leaveCommunity,
  fetchHelpfulMeta, toggleHelpful, fetchCommentCounts, fetchMyMembershipMap,
  getCommunityImageUrl, updateCommunity,
} from '../communitiesApi';

const TABS = [
  { key: 'motivational', label: 'Motivational' },
  { key: 'support', label: 'Seeking Support' },
];

function formatMembers(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K members`;
  return `${n} ${n === 1 ? 'member' : 'members'}`;
}

// A single community's home — description + Join/Joined up top, then the
// two tabs Girik asked for: Motivational posts and Seeking Support posts.
// Anyone signed in can browse and mark a post Helpful; only a current
// member can post or comment (matches the RLS policies on community_posts/
// community_post_comments — "+ New Post" is hidden rather than left to
// fail for a non-member).
export default function CommunityDetailScreen({ communityId, session, onBack, onCreatePost, onOpenComments }) {
  const [community, setCommunity] = useState(undefined); // undefined = loading, null = not found
  const [tag, setTag] = useState('motivational');
  const [posts, setPosts] = useState(null);
  const [authors, setAuthors] = useState({});
  const [avatarUrls, setAvatarUrls] = useState({});
  const [helpfulMeta, setHelpfulMeta] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [joining, setJoining] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const myAuthId = session?.user?.id;

  const loadCommunity = useCallback(async () => {
    const data = await fetchCommunity(communityId);
    setCommunity(data);
  }, [communityId]);

  const loadPosts = useCallback(async (activeTag) => {
    try {
      const data = await fetchCommunityPosts(communityId, activeTag);
      setPosts(data);
      const [authorMap, helpful, counts] = await Promise.all([
        fetchAuthorsByAuthId(data.map((p) => p.author_auth_id)),
        fetchHelpfulMeta(data.map((p) => p.id), myAuthId),
        fetchCommentCounts(data.map((p) => p.id)),
      ]);
      // Signed only after authorMap is known, same two-step dance as
      // Explore — there's no FK embed to ride a profile_picture_path along.
      const avatarPaths = Object.values(authorMap).map((a) => a.profile_picture_path).filter(Boolean);
      const avatars = await fetchSignedUrls('profile-pictures', avatarPaths);
      setAuthors(authorMap);
      setAvatarUrls(avatars);
      setHelpfulMeta(helpful);
      setCommentCounts(counts);
    } catch (e) {
      setError('Couldn’t load posts right now. Pull down to try again.');
      setPosts([]);
    }
  }, [communityId, myAuthId]);

  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    setPosts(null);
    loadPosts(tag);
  }, [tag, loadPosts]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadCommunity(), loadPosts(tag)]);
    setRefreshing(false);
  }

  async function handleToggleHelpful(postId) {
    const current = helpfulMeta[postId] || { count: 0, helpfulByMe: false };
    setHelpfulMeta((m) => ({
      ...m,
      [postId]: { count: current.count + (current.helpfulByMe ? -1 : 1), helpfulByMe: !current.helpfulByMe },
    }));
    try {
      await toggleHelpful(postId, myAuthId, current.helpfulByMe);
    } catch (e) {
      setHelpfulMeta((m) => ({ ...m, [postId]: current }));
    }
  }

  // is_member isn't tracked by community_listing (a plain view, no
  // per-viewer state) — fold in membership the same way the browse screen
  // does, via a quick membership check, so Join/Joined and "+ New Post"
  // are both correct on first paint rather than only after a toggle.
  const [isMember, setIsMember] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchMyMembershipMap([communityId], myAuthId).then((map) => {
      if (!cancelled) setIsMember(!!map[communityId]);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [communityId, myAuthId]);

  async function handleToggleJoin() {
    const was = isMember;
    setIsMember(!was);
    setJoining(true);
    setCommunity((c) => (c ? { ...c, member_count: Math.max(0, c.member_count + (was ? -1 : 1)) } : c));
    try {
      if (was) await leaveCommunity(communityId, myAuthId);
      else await joinCommunity(communityId, myAuthId);
    } catch (e) {
      setIsMember(was);
      setCommunity((c) => (c ? { ...c, member_count: Math.max(0, c.member_count + (was ? 1 : -1)) } : c));
    } finally {
      setJoining(false);
    }
  }

  // Only the person who created a community can change its image or
  // description afterward — name and topic stay fixed once set, matching
  // what CreateCommunityScreen collects. Gated by the communities_update_own
  // RLS policy server-side too, not just this UI check.
  const isCreator = !!myAuthId && !!community && community.creator_auth_id === myAuthId;
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  // null = no image | { uri, kept: true } = unchanged existing image |
  // { uri, base64, fileName, mimeType } = a freshly picked replacement
  const [editImage, setEditImage] = useState(null);
  const [editError, setEditError] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit() {
    setEditDescription(community.description || '');
    setEditImage(community.image_path ? { uri: getCommunityImageUrl(community.image_path), kept: true } : null);
    setEditError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    setEditError(null);
    try {
      let imagePath = community.image_path || null;
      if (editImage && !editImage.kept) {
        const path = `${myAuthId}/${Date.now()}-${editImage.fileName || 'community.jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(path, decode(editImage.base64), { contentType: editImage.mimeType || 'image/jpeg' });
        if (uploadError) throw uploadError;
        imagePath = path;
      } else if (!editImage) {
        imagePath = null;
      }
      const description = editDescription.trim() || null;
      await updateCommunity(communityId, { description, imagePath }, myAuthId);
      setCommunity((c) => (c ? { ...c, description, image_path: imagePath } : c));
      setEditing(false);
    } catch (e) {
      setEditError(e.message || 'Couldn’t save those changes. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  const header = useMemo(() => (
    <View>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{community?.name || 'Community'}</Text>
        <View style={styles.backBtn} />
      </View>

      {community ? (
        <>
          <View style={styles.identityBlock}>
            {editing ? (
              <>
                <ImagePickerField value={editImage} onChange={setEditImage} />
                <Text style={[styles.communityName, { marginTop: 12 }]}>{community.name}</Text>

                {editError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{editError}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.editDescInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="What is this community for? Who is it for?"
                  placeholderTextColor={colors.textSoft}
                  multiline
                  textAlignVertical="top"
                  maxLength={400}
                />

                <View style={styles.editActionsRow}>
                  <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit} disabled={savingEdit} activeOpacity={0.8}>
                    <Text style={styles.editCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editSaveBtn, savingEdit && styles.editSaveBtnDisabled]}
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editSaveBtnText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.avatarWrap}>
                  <View style={styles.iconTile}>
                    {community.image_path ? (
                      <Image source={{ uri: getCommunityImageUrl(community.image_path) }} style={styles.iconTileImage} />
                    ) : (
                      <Text style={styles.iconTileText}>{community.icon}</Text>
                    )}
                  </View>
                  {isCreator ? (
                    <TouchableOpacity
                      style={styles.editBadge}
                      onPress={startEdit}
                      activeOpacity={0.8}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil" size={12} color={colors.white} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.communityName}>{community.name}</Text>
                {community.description ? (
                  <Text style={styles.communityDesc}>{community.description}</Text>
                ) : null}
                <Text style={styles.memberCount}>{formatMembers(community.member_count)}</Text>

                <TouchableOpacity
                  style={[styles.joinBtn, isMember && styles.joinBtnJoined]}
                  onPress={handleToggleJoin}
                  disabled={joining}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.joinBtnText, isMember && styles.joinBtnTextJoined]}>
                    {isMember ? 'Joined' : 'Join Community'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.tabRow}>
            {TABS.map((t) => (
              <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setTag(t.key)} activeOpacity={0.7}>
                <Text style={[styles.tabLabel, tag === t.key && styles.tabLabelActive]}>{t.label}</Text>
                {tag === t.key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>

          {isMember && (
            <TouchableOpacity style={styles.newPostBtn} onPress={() => onCreatePost(communityId, tag)} activeOpacity={0.7}>
              <Ionicons name="add" size={16} color={colors.brown} />
              <Text style={styles.newPostBtnText}>New Post</Text>
            </TouchableOpacity>
          )}
        </>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  ), [
    community, isMember, joining, tag, error, communityId,
    isCreator, editing, editImage, editDescription, editError, savingEdit,
  ]);

  if (community === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  if (community === null) {
    return (
      <View style={styles.wrap}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Community</Text>
          <View style={styles.backBtn} />
        </View>
        <Text style={styles.emptyText}>This community isn’t available.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.wrap}
      ListHeaderComponent={header}
      data={posts || []}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brown} />}
      ListEmptyComponent={
        posts !== null && !error ? (
          <Text style={styles.emptyPostsText}>
            {tag === 'motivational'
              ? 'No motivational posts yet — be the first to share something encouraging.'
              : 'No one has posted here seeking support yet.'}
          </Text>
        ) : posts === null ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.brown} />
          </View>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 20 }}
      renderItem={({ item }) => (
        <CommunityPostCard
          post={item}
          author={authors[item.author_auth_id]}
          authorAvatarUrl={
            authors[item.author_auth_id]?.profile_picture_path
              ? avatarUrls[authors[item.author_auth_id].profile_picture_path]
              : null
          }
          helpful={helpfulMeta[item.id]}
          commentCount={commentCounts[item.id] || 0}
          onToggleHelpful={() => handleToggleHelpful(item.id)}
          onOpenComments={() => onOpenComments(item.id)}
          myAuthId={myAuthId}
          onReported={() => setPosts((list) => (list || []).filter((x) => x.id !== item.id))}
          onBlocked={() => loadPosts(tag)}
          style={styles.postCardSpacing}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 30 },
  emptyPostsText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 24, marginHorizontal: 30, lineHeight: 20 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32 },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },

  identityBlock: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  avatarWrap: { marginBottom: 12 },
  iconTile: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  iconTileImage: { width: '100%', height: '100%' },
  iconTileText: { fontSize: 30 },
  editBadge: {
    position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  communityName: { fontFamily: serif, fontSize: 21, color: colors.brown, fontWeight: '700', textAlign: 'center' },
  communityDesc: { fontSize: 13.5, color: colors.text, textAlign: 'center', marginTop: 8, lineHeight: 19, paddingHorizontal: 10 },
  memberCount: { fontSize: 12, color: colors.textSoft, marginTop: 10 },
  editDescInput: {
    alignSelf: 'stretch', borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 10,
    padding: 12, minHeight: 80, fontSize: 13.5, color: colors.text, marginTop: 16,
  },
  editActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  editCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.brownPale, borderRadius: 999,
    paddingVertical: 12, alignItems: 'center',
  },
  editCancelBtnText: { color: colors.brown, fontSize: 14, fontWeight: '700' },
  editSaveBtn: {
    flex: 1, backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 12,
    alignItems: 'center', overflow: 'visible',
  },
  editSaveBtnDisabled: { opacity: 0.6 },
  editSaveBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  joinBtn: {
    marginTop: 16, alignSelf: 'stretch', backgroundColor: colors.brown, borderRadius: 999,
    paddingVertical: 12, alignItems: 'center', overflow: 'visible',
  },
  joinBtnJoined: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brownPale },
  joinBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },
  joinBtnTextJoined: { color: colors.brown },

  tabRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)',
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 13.5, color: colors.textSoft, fontWeight: '600' },
  tabLabelActive: { color: colors.brown, fontWeight: '700' },
  tabUnderline: { height: 2, backgroundColor: colors.brown, alignSelf: 'stretch', marginTop: 10, borderRadius: 1 },

  newPostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1.5, borderColor: colors.brownPale, borderStyle: 'dashed', borderRadius: 999,
    paddingVertical: 10, marginHorizontal: 16, marginTop: 14, overflow: 'visible',
  },
  newPostBtnText: { color: colors.brown, fontSize: 13, fontWeight: '700' },

  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginHorizontal: 16, marginTop: 14,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },

  postCardSpacing: { marginHorizontal: 16, marginTop: 14, marginBottom: 0 },
});
