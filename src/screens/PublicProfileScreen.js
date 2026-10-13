import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { ROLE_LABELS, initialsFor, handleFor, formatCount } from '../roleLabels';
import PostCard from '../components/PostCard';
import {
  fetchPosts, fetchSignedUrls, fetchLikeMeta, fetchCommentCounts, toggleLike, fetchDirectoryPerson,
  getFollowStatus, getFollowerCount, followPerson, unfollowPerson, getPostCount, fetchMyDirectoryPerson,
  fetchCreatorHandle,
} from '../postsApi';
import { fetchFamilyByLeader, fetchMyMembership, requestToJoinFamily, withdrawRequest } from '../familyApi';
import { fetchMyCommunities } from '../communitiesApi';
import { WEB_BASE_URL } from '../config';

// Only Seekers/Assistants can request to join a family, and only Mothers/
// Pastors lead one — matches Spiritual Family's formation rules exactly.
const FAMILY_JOINABLE_LEADER_ROLES = ['mother', 'pastor'];
const FAMILY_REQUESTER_ROLES = ['seeker', 'assistant'];

// Roles that get the new Instagram-style profile (photo, @handle, bio,
// Posts/Followers/Communities stats, a real Follow button, a shop icon
// linking to their web storefront, and a Posts/Communities tab bar) — per
// Girik's instruction, this is Leaders, Mothers, and Pastors only. Seekers
// and Assistants keep the older About/Details/Support-Focus layout below,
// unchanged.
const FOLLOWABLE_ROLES = ['influencer', 'mother', 'pastor', 'church'];
// Every followable role can post (matches the posts table's insert policy), so
// their public profile shows their posts and post count.
const POSTING_ROLES = FOLLOWABLE_ROLES;

// Personal, request-based services offered on a Leader/Mother/Pastor's
// profile — distinct from the Spiritual Family flow above (which is a
// standing membership) and from Offerings (which are pre-built, paid
// content). There's no dedicated backend for these yet, so a request is
// just a Chat message with a pre-filled draft the Seeker can edit before
// sending — reuses the existing Chat/Premium infrastructure instead of
// inventing a new table and flow for something this small. Shown only for
// Approved leaders, same reasoning as canShowFamilyCard below.
const SERVICES = [
  {
    key: 'prayer',
    icon: 'flame-outline',
    title: 'Daily Prayers',
    description: 'Ask them to hold something specific in prayer each day this week.',
    draft: (name) => `Hi ${name}, I'd love to request Daily Prayers. Here's what I'd like you to hold in prayer this week: `,
  },
  {
    key: 'meditation',
    icon: 'moon-outline',
    title: 'Meditation',
    description: 'A guided meditation for peace, love, or provision — whichever you need.',
    draft: (name) => `Hi ${name}, I'd like to request a guided Meditation. What I'm seeking (peace, love, or provision): `,
  },
  {
    key: 'special',
    icon: 'mail-outline',
    title: 'Special Requests',
    description: 'Something specific on your heart that doesn’t fit the above? Send a private request.',
    draft: (name) => `Hi ${name}, I have a Special Request: `,
  },
];

// A read-only look at someone else's profile — reached by tapping a
// Directory card or a post's author.
//
// Leaders/Mothers/Pastors: matches the new reference Girik sent — avatar,
// name with a verified checkmark (Approved only), a cosmetic @handle (there
// is no real username field anywhere in sign-up, so this is their name
// slugified — see handleFor in roleLabels.js), their sign-up "story" reused
// as a bio line, a Posts/Followers/Communities stat row, a real Follow
// button (backed by the new `follows` table), a shop icon in the top bar
// (only shown once they've published a storefront handle on the website),
// and Posts/Communities tabs (the Communities tab lists the real
// communities this person has joined — see communitiesApi.js). One honest
// gap left: Mothers and Pastors can't actually create posts today (only an
// Approved influencers row unlocks "+ New Post" — see CreatePostScreen), so
// their Posts tab is honestly empty rather than faked. Worth a conversation
// if you want that opened up.
//
// Seekers/Assistants: the original design — a name/photo/role header, then
// About / Details / Support Focus sections on a shaded background, then a
// (currently inert) "Send a message" button. Details/Support Focus only
// show rows a person's role actually has data for (nothing invented) — see
// the "Directory" section of Supabase_Backend_Guide.md for exactly which
// field maps to which role.
export default function PublicProfileScreen({ role, id, session, onBack, onOpenComments, onSendMessage, onOpenCommunity }) {
  const [person, setPerson] = useState(null); // undefined = loading, null = not found
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [posts, setPosts] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [likeMeta, setLikeMeta] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [activeTab, setActiveTab] = useState('posts');
  const [myRole, setMyRole] = useState(null);
  const [familyForLeader, setFamilyForLeader] = useState(null); // this leader's spiritual_families row, if it exists yet
  const [myMembership, setMyMembership] = useState(null); // my own pending/accepted family_memberships row, if any
  const [familyBusy, setFamilyBusy] = useState(false);
  const [familyError, setFamilyError] = useState(null);
  const [shopHandle, setShopHandle] = useState(null);
  const [theirCommunities, setTheirCommunities] = useState(null); // null = loading

  const myAuthId = session?.user?.id;
  const isFollowable = FOLLOWABLE_ROLES.includes(role);
  // Approved-only: a Mother/Pastor who hasn't cleared vetting yet can still
  // be *seen* here (directory_listing deliberately shows everyone, "Pending
  // vetting" badge and all), but requestToJoinFamily's underlying insert is
  // blocked by RLS for anyone who isn't Approved (their own row is only
  // visible to themselves until then — see mothers_select_public_approved /
  // pastors_select_public_approved). Gating the card itself on approval
  // avoids offering a button that always fails with a raw RLS error.
  const canShowFamilyCard = FAMILY_JOINABLE_LEADER_ROLES.includes(role)
    && FAMILY_REQUESTER_ROLES.includes(myRole)
    && person?.vetting_status === 'Approved';

  // Any signed-in visitor viewing a different, Approved Leader/Mother/
  // Pastor can send a service request — not limited to Seekers/Assistants
  // the way Spiritual Family membership is, since these are one-off asks
  // rather than a standing relationship.
  const canShowServices = isFollowable
    && person?.auth_user_id !== myAuthId
    && person?.vetting_status === 'Approved';

  function handleRequestService(service) {
    if (!person) return;
    onSendMessage?.(person, service.draft(person.name || 'there'));
  }

  const load = useCallback(async () => {
    setLoading(true);
    setActiveTab('posts');
    setTheirCommunities(null);
    const data = await fetchDirectoryPerson(role, id);
    setPerson(data || null);

    if (data?.profile_picture_path) {
      const urls = await fetchSignedUrls('profile-pictures', [data.profile_picture_path]);
      setAvatarUrl(urls[data.profile_picture_path] || null);
    }

    if (POSTING_ROLES.includes(role)) {
      const theirPosts = await fetchPosts({ authorId: data?.auth_user_id });
      setPosts(theirPosts);
      const [images, likes, comments] = await Promise.all([
        fetchSignedUrls('post-images', theirPosts.map((p) => p.image_path).filter(Boolean)),
        fetchLikeMeta(theirPosts.map((p) => p.id), myAuthId),
        fetchCommentCounts(theirPosts.map((p) => p.id)),
      ]);
      setImageUrls(images);
      setLikeMeta(likes);
      setCommentCounts(comments);
    } else {
      setPosts([]);
    }

    if (data && FOLLOWABLE_ROLES.includes(role)) {
      const [following, followers, myPostCount, handle] = await Promise.all([
        getFollowStatus(myAuthId, data.auth_user_id),
        getFollowerCount(data.auth_user_id),
        POSTING_ROLES.includes(role) ? getPostCount(data.auth_user_id) : Promise.resolve(0),
        fetchCreatorHandle(data.auth_user_id),
      ]);
      setIsFollowing(following);
      setFollowerCount(followers);
      setPostCount(myPostCount);
      setShopHandle(handle);
    }

    if (data) {
      setTheirCommunities(await fetchMyCommunities(data.auth_user_id));
    }

    if (data && FAMILY_JOINABLE_LEADER_ROLES.includes(role) && data.auth_user_id !== myAuthId) {
      const [mine, fam] = await Promise.all([
        fetchMyDirectoryPerson(myAuthId),
        fetchFamilyByLeader(data.auth_user_id),
      ]);
      setMyRole(mine?.role || null);
      setFamilyForLeader(fam);
      if (mine && FAMILY_REQUESTER_ROLES.includes(mine.role)) {
        setMyMembership(await fetchMyMembership(myAuthId));
      } else {
        setMyMembership(null);
      }
    } else {
      setMyRole(null);
      setFamilyForLeader(null);
      setMyMembership(null);
    }

    setLoading(false);
  }, [role, id, myAuthId]);

  const sameFamily = !!(familyForLeader && myMembership && myMembership.family_id === familyForLeader.id);
  const memberOfOtherFamily = !!(myMembership && !sameFamily);

  async function handleRequestJoinFamily() {
    if (!person?.auth_user_id) return;
    setFamilyBusy(true);
    setFamilyError(null);
    try {
      const created = await requestToJoinFamily(myAuthId, person.auth_user_id, role);
      setMyMembership(created);
      setFamilyForLeader(await fetchFamilyByLeader(person.auth_user_id));
    } catch (e) {
      setFamilyError('Couldn’t send that request right now. Please try again in a moment.');
    } finally {
      setFamilyBusy(false);
    }
  }

  async function handleWithdrawFamilyRequest() {
    if (!myMembership) return;
    setFamilyBusy(true);
    setFamilyError(null);
    try {
      await withdrawRequest(myMembership.id);
      setMyMembership(null);
    } catch (e) {
      setFamilyError('Couldn’t withdraw that request right now. Please try again.');
    } finally {
      setFamilyBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

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

  async function handleToggleFollow() {
    if (!person?.auth_user_id || person.auth_user_id === myAuthId) return;
    const was = isFollowing;
    setIsFollowing(!was);
    setFollowerCount((c) => Math.max(0, c + (was ? -1 : 1)));
    try {
      if (was) await unfollowPerson(myAuthId, person.auth_user_id);
      else await followPerson(myAuthId, person.auth_user_id);
    } catch (e) {
      setIsFollowing(was);
      setFollowerCount((c) => Math.max(0, c + (was ? 1 : -1)));
    }
  }

  const showPostsList = isFollowable && activeTab === 'posts' && POSTING_ROLES.includes(role);
  const showCommunitiesList = isFollowable && activeTab === 'communities';
  const listData = showPostsList ? (posts || []) : showCommunitiesList ? (theirCommunities || []) : [];
  let emptyMessage = null;
  if (isFollowable) {
    if (activeTab === 'posts') {
      emptyMessage = 'No posts yet.';
    } else if (activeTab === 'communities' && theirCommunities !== null && theirCommunities.length === 0) {
      emptyMessage = `${person?.name || 'This person'} hasn’t joined any communities yet.`;
    }
  }

  const header = (
    <View>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{loading ? '' : (person?.name || 'Profile')}</Text>
        {isFollowable && shopHandle ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(`${WEB_BASE_URL}/creator/${shopHandle}`)}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="storefront-outline" size={20} color={colors.brown} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : !person ? (
        <Text style={styles.emptyText}>This profile isn’t available.</Text>
      ) : isFollowable ? (
        <>
          <View style={styles.identityBlockNew}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFor(person.name)}</Text>
              </View>
            )}
            <View style={styles.nameLine}>
              <Text style={styles.nameNew}>{person.name || 'Unnamed'}</Text>
              {person.vetting_status === 'Approved' && (
                <Ionicons name="checkmark-circle" size={17} color={colors.brown} style={styles.verifiedIcon} />
              )}
            </View>
            <Text style={styles.handleText}>{handleFor(person.name)}</Text>
            {person.story ? (
              <Text style={styles.bioText} numberOfLines={3}>{person.story}</Text>
            ) : null}
            {person.vetting_status === 'Needs Vetting' && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending vetting</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCount(postCount)}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCount(followerCount)}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCount(theirCommunities?.length || 0)}</Text>
                <Text style={styles.statLabel}>Communities</Text>
              </View>
            </View>

            {person.auth_user_id !== myAuthId && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.followBtnLarge, styles.followBtnInRow, isFollowing && styles.followBtnLargeActive]}
                  onPress={handleToggleFollow}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.followBtnLargeText, isFollowing && styles.followBtnLargeTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.messageIconBtn}
                  onPress={() => onSendMessage?.(person)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={colors.brown} />
                </TouchableOpacity>
              </View>
            )}

            {canShowFamilyCard && person.auth_user_id !== myAuthId && (
              <View style={styles.familyCard}>
                {sameFamily && myMembership.status === 'accepted' ? (
                  <View style={styles.familyRow}>
                    <Ionicons name="home" size={15} color={colors.brown} />
                    <Text style={styles.familyText}>You're part of {person.name}'s Spiritual Family</Text>
                  </View>
                ) : sameFamily && myMembership.status === 'pending' ? (
                  <View style={styles.familyRow}>
                    <Text style={styles.familyText}>Request pending to join {person.name}'s Spiritual Family</Text>
                    <TouchableOpacity onPress={handleWithdrawFamilyRequest} disabled={familyBusy}>
                      {familyBusy ? <ActivityIndicator size="small" color={colors.brown} /> : <Text style={styles.familyWithdraw}>Withdraw</Text>}
                    </TouchableOpacity>
                  </View>
                ) : memberOfOtherFamily ? (
                  <Text style={styles.familyMuted}>You're already part of another Spiritual Family.</Text>
                ) : (
                  <TouchableOpacity style={styles.familyBtn} onPress={handleRequestJoinFamily} disabled={familyBusy} activeOpacity={0.85}>
                    {familyBusy ? (
                      <ActivityIndicator color={colors.brown} />
                    ) : (
                      <Text style={styles.familyBtnText}>Request to Join This Spiritual Family</Text>
                    )}
                  </TouchableOpacity>
                )}
                {familyError ? <Text style={styles.familyErrorText}>{familyError}</Text> : null}
              </View>
            )}

            {canShowServices && (
              <View style={styles.servicesBox}>
                <Text style={styles.servicesTitle}>Additional Services</Text>
                <Text style={styles.servicesSubtitle}>
                  Personal requests held between you and {person.name}. Tap one to send it — they’ll answer you in Chat.
                </Text>
                {SERVICES.map((service, i) => (
                  <View key={service.key} style={[styles.serviceRow, i === SERVICES.length - 1 && styles.serviceRowLast]}>
                    <View style={styles.serviceIcon}>
                      <Ionicons name={service.icon} size={18} color={colors.brown} />
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      <Text style={styles.serviceDescription}>{service.description}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.serviceBtn}
                      onPress={() => handleRequestService(service)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.serviceBtnText}>Request</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.tabRow}>
            {[['posts', 'Posts'], ['communities', 'Communities']].map(([key, label]) => (
              <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setActiveTab(key)} activeOpacity={0.7}>
                <Text style={[styles.tabLabel, activeTab === key && styles.tabLabelActive]}>{label}</Text>
                {activeTab === key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.identityBlock}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFor(person.name)}</Text>
              </View>
            )}
            <Text style={styles.name}>{person.name || 'Unnamed'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{(ROLE_LABELS[person.role] || person.role).toUpperCase()}</Text>
            </View>
            {person.vetting_status === 'Needs Vetting' && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending vetting</Text>
              </View>
            )}
          </View>

          <View style={styles.shadedSection}>
            {person.story ? (
              <>
                <Text style={styles.sectionLabel}>About</Text>
                <View style={styles.aboutCard}>
                  <Text style={styles.aboutText}>{person.story}</Text>
                </View>
              </>
            ) : null}

            {(person.faith_tradition || person.years_experience || person.capacity) ? (
              <>
                <Text style={styles.sectionLabel}>Details</Text>
                <View style={styles.detailsCard}>
                  {person.faith_tradition ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Faith Tradition</Text>
                      <Text style={styles.detailValue}>{person.faith_tradition}</Text>
                    </View>
                  ) : null}
                  {person.years_experience ? (
                    <View style={[styles.detailRow, person.faith_tradition && styles.detailRowBorder]}>
                      <Text style={styles.detailLabel}>Years of Experience</Text>
                      <Text style={styles.detailValue}>{person.years_experience}</Text>
                    </View>
                  ) : null}
                  {person.capacity ? (
                    <View style={[styles.detailRow, (person.faith_tradition || person.years_experience) && styles.detailRowBorder]}>
                      <Text style={styles.detailLabel}>Capacity</Text>
                      <Text style={styles.detailValue}>{person.capacity}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {person.focus_areas && person.focus_areas.length ? (
              <>
                <Text style={styles.sectionLabel}>Support Focus</Text>
                <View style={styles.chipRow}>
                  {person.focus_areas.map((tag) => (
                    <View key={tag} style={styles.chip}>
                      <Text style={styles.chipText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.sendDivider} />
            <TouchableOpacity style={styles.sendBtn} activeOpacity={0.8} onPress={() => onSendMessage?.(person)}>
              <Text style={styles.sendBtnText}>Send a message</Text>
            </TouchableOpacity>
            <Text style={styles.sendCaption}>Starting a new conversation requires Premium — replying is always free</Text>
          </View>
        </>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.wrap}
      ListHeaderComponent={header}
      data={listData}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !loading && person && emptyMessage ? (
          <Text style={styles.emptyPostsText}>{emptyMessage}</Text>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: 20 }}
      renderItem={({ item }) => {
        if (showCommunitiesList) {
          return (
            <TouchableOpacity style={styles.communityRow} activeOpacity={0.8} onPress={() => onOpenCommunity?.(item.id)}>
              <View style={styles.communityRowIcon}>
                <Text style={styles.communityRowIconText}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.communityRowName}>{item.name}</Text>
                <Text style={styles.communityRowMeta} numberOfLines={1}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
            </TouchableOpacity>
          );
        }
        const meta = likeMeta[item.id] || { count: 0, likedByMe: false };
        return (
          <PostCard
            post={item}
            author={person}
            imageUrl={item.image_path ? imageUrls[item.image_path] : null}
            authorAvatarUrl={avatarUrl}
            liked={meta.likedByMe}
            likeCount={meta.count}
            commentCount={commentCounts[item.id] || 0}
            onToggleLike={() => handleToggleLike(item.id)}
            onOpenComments={() => onOpenComments(item.id)}
            onOpenAuthor={() => {}}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 30 },
  emptyPostsText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 24, marginHorizontal: 30, lineHeight: 20 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32 },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },

  avatarImg: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.creamDark, marginBottom: 14 },
  avatarFallback: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 30 },

  // --- New Instagram-style header (Leaders, Mothers, Pastors) ---
  identityBlockNew: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16 },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  nameNew: { fontFamily: serif, fontSize: 21, color: colors.brown, fontWeight: '700' },
  verifiedIcon: { marginLeft: 5 },
  handleText: { fontSize: 13.5, color: colors.textSoft, marginTop: 3 },
  bioText: { fontSize: 13.5, color: colors.text, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  statsRow: { flexDirection: 'row', marginTop: 18, gap: 36 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 17, color: colors.brown, fontWeight: '700' },
  statLabel: { fontSize: 11.5, color: colors.textSoft, marginTop: 2, letterSpacing: 0.3 },
  actionRow: { flexDirection: 'row', alignSelf: 'stretch', gap: 8, marginTop: 16 },
  followBtnLarge: {
    marginTop: 16, alignSelf: 'stretch', backgroundColor: colors.brown, borderRadius: 999,
    paddingVertical: 12, alignItems: 'center', overflow: 'visible',
  },
  followBtnInRow: { flex: 1, marginTop: 0 },
  followBtnLargeActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brownPale },
  followBtnLargeText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },
  followBtnLargeTextActive: { color: colors.brown },
  messageIconBtn: {
    width: 46, borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  familyCard: { alignSelf: 'stretch', marginTop: 12 },
  familyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  familyText: { fontSize: 12.5, color: colors.textSoft, textAlign: 'center' },
  familyWithdraw: { fontSize: 12.5, color: colors.errorText, fontWeight: '700' },
  familyMuted: { fontSize: 12, color: colors.textSoft, textAlign: 'center', fontStyle: 'italic' },
  familyErrorText: { fontSize: 12, color: colors.errorText, textAlign: 'center', marginTop: 8 },
  familyBtn: {
    alignSelf: 'stretch', borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999,
    paddingVertical: 11, alignItems: 'center', overflow: 'visible',
  },
  familyBtnText: { color: colors.brown, fontSize: 13, fontWeight: '700' },
  servicesBox: {
    alignSelf: 'stretch', marginTop: 14, backgroundColor: colors.creamDark, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.14)', padding: 14,
  },
  servicesTitle: { fontFamily: serif, fontSize: 15.5, color: colors.brown, fontWeight: '700' },
  servicesSubtitle: { fontSize: 12, color: colors.textSoft, marginTop: 3, lineHeight: 17 },
  serviceRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.12)', marginTop: 4,
  },
  serviceRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  serviceIcon: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },
  serviceCopy: { flex: 1 },
  serviceTitle: { fontSize: 13.5, color: colors.text, fontWeight: '700' },
  serviceDescription: { fontSize: 12, color: colors.textSoft, marginTop: 2, lineHeight: 16.5 },
  serviceBtn: {
    borderWidth: 1, borderColor: colors.brownPale, backgroundColor: colors.white, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 13, alignSelf: 'center', overflow: 'visible',
  },
  serviceBtnText: { fontSize: 12, color: colors.brown, fontWeight: '700' },
  tabRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)',
    marginHorizontal: -24, paddingHorizontal: 24,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 13.5, color: colors.textSoft, fontWeight: '600' },
  tabLabelActive: { color: colors.brown, fontWeight: '700' },
  tabUnderline: { height: 2, backgroundColor: colors.brown, alignSelf: 'stretch', marginTop: 10, borderRadius: 1 },

  // --- Classic header (Seekers, Assistants) ---
  identityBlock: { alignItems: 'center', paddingVertical: 22 },
  name: { fontFamily: serif, fontSize: 22, color: colors.brown, fontWeight: '700' },
  // overflow: 'visible' on every rounded badge/chip/button below guards
  // against a real bug found on-device: a rounded View with a solid
  // backgroundColor can get its text clipped top-and-bottom by iOS's own
  // corner-radius mask if that mask applies before layout has fully
  // settled — see the long comment on DirectoryScreen's filterPill for
  // the full story (that's where it was actually caught and diagnosed).
  roleBadge: { backgroundColor: colors.creamDark, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, marginTop: 8, overflow: 'visible' },
  roleBadgeText: { fontSize: 11, color: colors.brown, fontWeight: '700', letterSpacing: 0.6 },
  pendingBadge: { backgroundColor: colors.errorBg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 10, overflow: 'visible' },
  pendingBadgeText: { fontSize: 11.5, color: colors.errorText, fontWeight: '700' },

  // Bleeds past the panel's own padding to read as a distinct shaded
  // section, matching the two-tone look (white header, tinted body) in
  // the reference — safe to bleed here since it's only a background color,
  // not text that could get clipped at the edge.
  shadedSection: { backgroundColor: colors.cream, marginHorizontal: -24, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  sectionLabel: { fontSize: 12, color: colors.brown, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, marginTop: 16 },
  aboutCard: {
    backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(107,66,38,0.1)', padding: 14,
  },
  aboutText: { fontSize: 14.5, color: colors.text, lineHeight: 21 },
  detailsCard: {
    backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(107,66,38,0.1)', paddingHorizontal: 14,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.08)' },
  detailLabel: { fontSize: 13.5, color: colors.textSoft },
  detailValue: { fontSize: 14.5, color: colors.text, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, overflow: 'visible' },
  chipText: { fontSize: 12.5, color: colors.brown, fontWeight: '600' },
  sendDivider: { height: 1, backgroundColor: 'rgba(107,66,38,0.1)', marginTop: 20, marginBottom: 18 },
  sendBtn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 14, alignItems: 'center', overflow: 'visible' },
  sendBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  sendCaption: { textAlign: 'center', fontSize: 12, color: colors.textSoft, marginTop: 8 },

  communityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.08)',
  },
  communityRowIcon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  communityRowIconText: { fontSize: 20 },
  communityRowName: { fontSize: 14, color: colors.text, fontWeight: '700' },
  communityRowMeta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
});
