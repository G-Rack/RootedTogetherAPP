import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import PostFeedView from '../components/PostFeedView';
import PostGridCell, { postGridRowStyle, gridBleedListStyle, gridHeaderPad } from '../components/PostGridCell';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { ROLE_LABELS, initialsFor, handleFor, formatCount } from '../roleLabels';
import {
  fetchMyDirectoryPerson, fetchPosts, fetchSignedUrls, getPostCount, getFollowerCount,
  updateMyProfilePicture, deleteMyAccount,
} from '../postsApi';
import { fetchMyCommunities, getGrowthScore } from '../communitiesApi';
import { WEB_BASE_URL } from '../config';
import BlockedUsersScreen from './BlockedUsersScreen';
import { fetchMyFullProfileRow } from '../profileEditing';
import { buildChecklist } from '../profileChecklist';
import ProfileChecklistScreen from './ProfileChecklistScreen';
import EditProfileScreen from './EditProfileScreen';
import ChangePasswordScreen from './ChangePasswordScreen';
import PayoutsReferralsScreen from './PayoutsReferralsScreen';

// Same split as PublicProfileScreen's read-only view, applied to the
// signed-in person's OWN profile: Leaders/Mothers/Pastors get the
// Instagram-style self-profile (post grid, Edit Profile, a settings
// gear); Seekers/Assistants get the classic About/Details layout plus
// the new Dedication Scorecard — a placeholder that will grow into a real
// consistency tracker (prayer, check-ins, growth) over time, not invented
// data pretending to be real yet.
// Every role now gets the same Instagram-style profile: post grid, New Post,
// Communities tab with Create Community. (Seekers and Assistants used to get
// a plainer About/Details layout.) Only the leader roles see Payouts below.
const FOLLOWABLE_ROLES = ['influencer', 'mother', 'pastor', 'church', 'seeker', 'assistant'];
const LEADER_TOOL_ROLES = ['influencer', 'mother', 'pastor', 'church'];

function SettingsRow({ label, onPress, last, danger, showDot }) {
  return (
    <TouchableOpacity style={[styles.settingsRow, !last && styles.settingsRowBorder]} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.settingsRowLabelWrap}>
        <Text style={[styles.settingsRowLabel, danger && styles.settingsRowLabelDanger]}>{label}</Text>
        {showDot && <View style={styles.notifDotInline} />}
      </View>
      <Ionicons name="chevron-forward" size={15} color={danger ? colors.errorText : colors.textSoft} />
    </TouchableOpacity>
  );
}

// This is the real "Profile" tab — replacing the old placeholder that only
// had a Log out button. It's built around the same directory_listing view
// every other profile screen already reads from, just filtered to the
// signed-in person's own auth_user_id (see fetchMyDirectoryPerson).
export default function ProfileScreen({ session, onLogOut, onCreatePost, onOpenComments, onOpenCommunity, onCreateCommunity, onOpenProfile, intent, onIntentConsumed }) {
  // Instagram-style: tapping a grid post opens the full-size Posts view
  // (PostFeedView) scrolled to that post.
  const [feedPostId, setFeedPostId] = useState(null);
  const [person, setPerson] = useState(undefined); // undefined = loading, null = no row found
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [posts, setPosts] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [followerCount, setFollowerCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [activeTab, setActiveTab] = useState('posts');
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showPayouts, setShowPayouts] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [myCommunities, setMyCommunities] = useState(null); // null = loading
  const [growthScore, setGrowthScore] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  // Whether the bio actually runs past 3 lines — set from measuring the
  // full, untruncated text below, so "... more" only shows up when the
  // bio is genuinely long enough to need it.
  const [bioTruncatable, setBioTruncatable] = useState(false);
  // Defaults to true (no nag) until the real row loads, so there's no
  // flash of "incomplete" before fetchMyFullProfileRow resolves.
  const [profileDetailsComplete, setProfileDetailsComplete] = useState(true);
  // "Complete your profile" checklist (what the short sign-up skipped).
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklist, setChecklist] = useState(null);

  const myAuthId = session?.user?.id;
  const isFollowable = person && FOLLOWABLE_ROLES.includes(person.role);

  const load = useCallback(async () => {
    const data = await fetchMyDirectoryPerson(myAuthId);
    setPerson(data || null);

    // Did they skip the optional "tell us more about yourself" step at
    // sign-up (see the Sign-up Decision screen's "Skip for now") and never
    // come back to it? directory_listing doesn't carry those role-specific
    // columns, so this needs the person's actual role-table row.
    if (data) {
      const fullRow = await fetchMyFullProfileRow(myAuthId, data.role);
      const cl = buildChecklist(data.role, fullRow);
      setChecklist(cl);
      setProfileDetailsComplete(cl.total === 0 || cl.complete);
    }

    if (data?.profile_picture_path) {
      const urls = await fetchSignedUrls('profile-pictures', [data.profile_picture_path]);
      setAvatarUrl(urls[data.profile_picture_path] || null);
    }

    if (data && FOLLOWABLE_ROLES.includes(data.role)) {
      const followers = await getFollowerCount(myAuthId);
      setFollowerCount(followers);
    }

    if (data && FOLLOWABLE_ROLES.includes(data.role)) {
      const [myPosts, count] = await Promise.all([
        fetchPosts({ authorId: data.auth_user_id }),
        getPostCount(data.auth_user_id),
      ]);
      setPosts(myPosts);
      setPostCount(count);
      const images = await fetchSignedUrls('post-images', myPosts.map((p) => p.image_path).filter(Boolean));
      setImageUrls(images);
    }

    if (data && !FOLLOWABLE_ROLES.includes(data.role)) {
      const score = await getGrowthScore(myAuthId);
      setGrowthScore(score);
    }

    const communities = await fetchMyCommunities(myAuthId);
    setMyCommunities(communities);
  }, [myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  // Opened from the Explore card or the welcome screen's "Finish my profile".
  useEffect(() => {
    if (intent === 'checklist') {
      setShowChecklist(true);
      onIntentConsumed?.();
    }
  }, [intent, onIntentConsumed]);

  // Lets someone replace their own profile photo — the pencil badge on the
  // avatar used to just show a "coming later" alert. Picks from the photo
  // library, uploads through the update-profile-picture Edge Function
  // (profile-pictures is a private bucket with no direct client-write
  // policy), then re-signs a URL for the new path so the new photo shows
  // immediately without a full screen reload.
  async function handleChangePhoto() {
    if (!person || uploadingPhoto) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Enable photo library access in Settings to change your profile picture.');
        return;
      }
      const mediaTypes = ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'];
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploadingPhoto(true);
      const path = await updateMyProfilePicture(session, person.role, {
        base64: asset.base64,
        fileName: asset.fileName || 'profile.jpg',
        mimeType: asset.mimeType || 'image/jpeg',
      });
      const urls = await fetchSignedUrls('profile-pictures', [path]);
      setAvatarUrl(urls[path] || null);
    } catch (e) {
      Alert.alert('Couldn’t update your photo', e.message || 'Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Permanently deletes the signed-in person's own account, via the
  // delete-account Edge Function (deleting the underlying login needs the
  // service-role key, which never exists on-device). What happens to the
  // rest of their data follows the database's own foreign-key rules —
  // most content (posts, messages, family updates, communities, etc.) is
  // removed along with the account, but a Mother or Pastor's Spiritual
  // Family is a special case worth calling out before they confirm: that
  // whole family group — and every sibling's place in it — goes with it,
  // since the family row cascades off its leader's account.
  function handleDeleteAccount() {
    if (!person || deletingAccount) return;
    const leadsFamily = person.role === 'mother' || person.role === 'pastor';
    const message = leadsFamily
      ? 'This permanently deletes your account along with your posts, messages, and everything else attached to it — this can’t be undone. Because you lead a Spiritual Family, deleting your account will also remove that family and everyone in it.'
      : 'This permanently deletes your account along with your posts, messages, and everything else attached to it. This can’t be undone.';
    Alert.alert('Delete Account', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: async () => {
          setDeletingAccount(true);
          try {
            await deleteMyAccount(session);
            onLogOut();
          } catch (e) {
            Alert.alert('Couldn’t delete your account', e.message || 'Please try again.');
          } finally {
            setDeletingAccount(false);
          }
        },
      },
    ]);
  }

  const gearButton = (
    <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <View>
        <Ionicons name="settings-outline" size={20} color={colors.brown} />
        {!profileDetailsComplete && <View style={styles.notifDot} />}
      </View>
    </TouchableOpacity>
  );

  // Top-left on every version of someone's own Profile page — deep-links to
  // the companion website's home page (rootedtogether.club), where the
  // marketplace lives, rather than any one person's own storefront, so
  // it's shown to everyone regardless of role rather than gated behind
  // having published a storefront handle.
  const marketplaceButton = (
    <TouchableOpacity
      onPress={() => Linking.openURL(WEB_BASE_URL)}
      style={styles.shopBtn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="storefront-outline" size={20} color={colors.brown} />
    </TouchableOpacity>
  );

  if (showEditProfile) {
    return (
      <EditProfileScreen
        session={session}
        person={person}
        onBack={() => setShowEditProfile(false)}
        onSaved={() => {
          setShowEditProfile(false);
          load();
        }}
      />
    );
  }

  if (showChecklist) {
    if (!checklist) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.brown} />
        </View>
      );
    }
    return (
      <ProfileChecklistScreen
        checklist={checklist}
        onBack={() => setShowChecklist(false)}
        onEdit={() => setShowEditProfile(true)}
        onPickPhoto={async () => { await handleChangePhoto(); load(); }}
      />
    );
  }

  if (showChangePassword) {
    return (
      <ChangePasswordScreen
        session={session}
        onBack={() => setShowChangePassword(false)}
      />
    );
  }

  if (showPayouts) {
    return <PayoutsReferralsScreen onBack={() => setShowPayouts(false)} person={person} />;
  }

  if (showBlocked) {
    return (
      <View style={styles.wrap}>
        <BlockedUsersScreen onBack={() => setShowBlocked(false)} />
      </View>
    );
  }

  if (showSettings) {
    return (
      <View style={styles.wrap}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowSettings(false)} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Settings</Text>
          <View style={styles.backBtn} />
        </View>

        <Text style={styles.settingsSectionLabel}>Account</Text>
        <View style={styles.settingsCard}>
          <SettingsRow
            label="Edit Profile Information"
            onPress={() => setShowEditProfile(true)}
            showDot={!profileDetailsComplete}
          />
          <SettingsRow label="Change Password" onPress={() => setShowChangePassword(true)} last />
        </View>

        {person && LEADER_TOOL_ROLES.includes(person.role) && (
          <>
            <Text style={styles.settingsSectionLabel}>Leader Tools</Text>
            <View style={styles.settingsCard}>
              <SettingsRow label="Payouts & Referrals" onPress={() => setShowPayouts(true)} last />
            </View>
          </>
        )}

        <Text style={styles.settingsSectionLabel}>More</Text>
        <View style={styles.settingsCard}>
          <SettingsRow label="Blocked users" onPress={() => setShowBlocked(true)} />
          <SettingsRow label="Terms of Service" onPress={() => Linking.openURL(`${WEB_BASE_URL}/terms`)} />
          <SettingsRow label="Privacy Policy" onPress={() => Linking.openURL(`${WEB_BASE_URL}/privacy`)} />
          <SettingsRow label="Notifications" onPress={() => Linking.openSettings()} />
          <SettingsRow label="Help & Support" onPress={() => Linking.openURL('mailto:admin@rootedtogether.club?subject=Rooted%20Together%20support')} last />
        </View>

        <View style={[styles.settingsCard, { marginTop: 22 }]}>
          <SettingsRow
            label={deletingAccount ? 'Deleting your account…' : 'Delete Account'}
            onPress={handleDeleteAccount}
            danger
            last
          />
        </View>

        <TouchableOpacity style={styles.logOutRow} onPress={onLogOut} activeOpacity={0.7}>
          <Text style={styles.logOutRowText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (person === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  if (person === null) {
    return (
      <View style={styles.wrap}>
        <View style={styles.topBar}>
          {marketplaceButton}
          <Text style={styles.topBarTitle}>Profile</Text>
          {gearButton}
        </View>
        <Text style={styles.emptyText}>We couldn’t load your profile right now.</Text>
        <TouchableOpacity style={styles.logOutRow} onPress={onLogOut} activeOpacity={0.7}>
          <Text style={styles.logOutRowText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Instagram-style self-profile: Leaders, Mothers, Pastors ---
  if (isFollowable) {
    // Posting is open to every followable leader role (Spiritual Mothers,
    // Pastors/Priests, and Spiritual Leaders/Influencers) — not just
    // Influencers. It used to be gated to role === 'influencer' here (and
    // in load()'s fetch above), which silently hid real posts and the New
    // Post button for Mothers and Pastors even when they had posts in the
    // database already.
    const showPostGrid = activeTab === 'posts';
    const showCommunitiesList = activeTab === 'communities';
    const gridData = showPostGrid ? posts : showCommunitiesList ? (myCommunities || []) : [];
    let emptyMessage = null;
    if (activeTab === 'posts') {
      emptyMessage = 'No posts yet — tap “New Post” to share something with your community.';
    } else if (activeTab === 'communities' && myCommunities !== null && myCommunities.length === 0) {
      emptyMessage = 'You haven’t joined any communities yet — visit the Communities tab to browse and join one.';
    }

    const header = (
      <View>
        <View style={styles.topBar}>
          {marketplaceButton}
          <Text style={styles.topBarTitle}>Profile</Text>
          {gearButton}
        </View>

        <View style={styles.identityBlockNew}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFor(person.name)}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.avatarEditBadge} onPress={handleChangePhoto} disabled={uploadingPhoto} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="pencil" size={11} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.nameLine}>
            <Text style={styles.nameNew}>{person.name || 'Unnamed'}</Text>
            {person.vetting_status === 'Approved' && (
              <Ionicons name="checkmark-circle" size={17} color={colors.brown} style={styles.verifiedIcon} />
            )}
          </View>
          <Text style={styles.handleText}>{handleFor(person.name)}</Text>
          {person.story ? (
            <View style={styles.bioWrap}>
              {/* Invisible full-height measurer: tells us whether the real
                  (clamped) text below is actually being cut off, so "...
                  more" only appears when the bio genuinely runs past 3
                  lines rather than on every profile. */}
              <Text
                style={[styles.bioText, styles.bioMeasure]}
                onTextLayout={(e) => setBioTruncatable(e.nativeEvent.lines.length > 3)}
              >
                {person.story}
              </Text>
              <Text style={styles.bioText} numberOfLines={bioExpanded ? undefined : 3}>
                {person.story}
              </Text>
              {bioTruncatable && (
                <TouchableOpacity
                  onPress={() => setBioExpanded((v) => !v)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.bioMoreText}>{bioExpanded ? 'Show less' : '… more'}</Text>
                </TouchableOpacity>
              )}
            </View>
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
              <Text style={styles.statValue}>{formatCount(myCommunities?.length || 0)}</Text>
              <Text style={styles.statLabel}>Communities</Text>
            </View>
          </View>

          {!profileDetailsComplete && (
            <TouchableOpacity style={styles.completeBanner} onPress={() => setShowChecklist(true)} activeOpacity={0.8}>
              <Ionicons name="information-circle-outline" size={16} color={colors.errorText} />
              <Text style={styles.completeBannerText}>
                Your profile is missing a few details — tap to finish it.
              </Text>
            </TouchableOpacity>
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

        {activeTab === 'communities' && (
          <TouchableOpacity style={styles.newPostBtn} onPress={onCreateCommunity} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color={colors.brown} />
            <Text style={styles.newPostBtnText}>Create Community</Text>
          </TouchableOpacity>
        )}
      </View>
    );

    if (feedPostId && posts.length) {
      return (
        <PostFeedView
          session={session}
          posts={posts}
          startPostId={feedPostId}
          author={person}
          authorAvatarUrl={avatarUrl}
          imageUrls={imageUrls}
          onBack={() => setFeedPostId(null)}
          onOpenPerson={(p) => onOpenProfile?.(p.role, p.id)}
        />
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          key={activeTab}
          style={[styles.wrap, showPostGrid && gridBleedListStyle]}
          ListHeaderComponent={showPostGrid ? <View style={gridHeaderPad}>{header}</View> : header}
          data={gridData}
          keyExtractor={(item) => item.id}
          numColumns={showCommunitiesList ? 1 : 3}
          columnWrapperStyle={!showCommunitiesList && gridData.length ? postGridRowStyle : undefined}
          ListEmptyComponent={
            emptyMessage
              ? <Text style={styles.emptyPostsText}>{emptyMessage}</Text>
              : showCommunitiesList && myCommunities === null
                ? <ActivityIndicator color={colors.brown} style={{ marginTop: 24 }} />
                : null
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            showCommunitiesList ? (
              <TouchableOpacity style={styles.communityRow} activeOpacity={0.8} onPress={() => onOpenCommunity(item.id)}>
                <View style={styles.communityRowIcon}>
                  <Text style={styles.communityRowIconText}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.communityRowName}>{item.name}</Text>
                  <Text style={styles.communityRowMeta} numberOfLines={1}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
              </TouchableOpacity>
            ) : (
              <PostGridCell
                post={item}
                imageUrl={item.image_path ? imageUrls[item.image_path] : null}
                onPress={() => setFeedPostId(item.id)}
              />
            )
          )}
        />

        {activeTab === 'posts' && (
          <TouchableOpacity
            style={styles.newPostFab}
            onPress={onCreatePost}
            activeOpacity={0.85}
            accessibilityLabel="New Post"
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // --- Classic self-profile + Dedication Scorecard: Seekers, Assistants ---
  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        {marketplaceButton}
        <Text style={styles.topBarTitle}>Profile</Text>
        {gearButton}
      </View>

      <View style={styles.identityBlock}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initialsFor(person.name)}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.avatarEditBadge} onPress={handleChangePhoto} disabled={uploadingPhoto} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="pencil" size={11} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{person.name || 'Unnamed'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{(ROLE_LABELS[person.role] || person.role).toUpperCase()}</Text>
        </View>
        {person.vetting_status === 'Needs Vetting' && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending vetting</Text>
          </View>
        )}
        {!profileDetailsComplete && (
          <TouchableOpacity style={styles.completeBanner} onPress={() => setShowChecklist(true)} activeOpacity={0.8}>
            <Ionicons name="information-circle-outline" size={16} color={colors.errorText} />
            <Text style={styles.completeBannerText}>
              Your profile is missing a few details — tap to finish it.
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        style={styles.wrap}
        data={[]}
        keyExtractor={() => 'x'}
        renderItem={null}
        ListHeaderComponent={
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
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 30, marginBottom: 20 },
  emptyPostsText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 24, marginHorizontal: 30, lineHeight: 20 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32, alignItems: 'flex-end' },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },
  shopBtn: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },

  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.creamDark },
  avatarFallback: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 30 },
  avatarEditBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.brown, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
  },

  // --- Instagram-style self-profile (Leaders, Mothers, Pastors) ---
  identityBlockNew: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16 },
  nameLine: { flexDirection: 'row', alignItems: 'center' },
  nameNew: { fontFamily: serif, fontSize: 20, color: colors.brown, fontWeight: '700' },
  verifiedIcon: { marginLeft: 5 },
  handleText: { fontSize: 13.5, color: colors.textSoft, marginTop: 3 },
  bioWrap: { alignItems: 'center', alignSelf: 'stretch', position: 'relative' },
  bioText: { fontSize: 13.5, color: colors.text, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  // Positioned off-screen rather than just opacity: 0 — it still needs to
  // lay out at the real width to measure true line count, but must never
  // take up space or be visible/tappable in the real layout.
  bioMeasure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0, zIndex: -1 },
  bioMoreText: { fontSize: 12.5, color: colors.textSoft, fontWeight: '700', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 18, gap: 36 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 15, color: colors.brown, fontWeight: '700' },
  statLabel: { fontSize: 10.5, color: colors.textSoft, marginTop: 2, letterSpacing: 0.4 },
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

  // Floating "new post" button — replaces the old dashed "New Post" banner
  // above the grid. Lives in the bottom-right corner of the Posts tab only,
  // absolutely positioned over the FlatList (its parent View wraps both).
  newPostFab: {
    position: 'absolute', right: 18, bottom: 18, width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6,
    elevation: 5,
  },

  gridRow: { gap: 6, paddingHorizontal: 10 },
  gridCell: {
    flex: 1 / 3, aspectRatio: 1, margin: 3, backgroundColor: colors.creamDark,
    borderRadius: 12, overflow: 'hidden',
  },
  gridImg: { width: '100%', height: '100%' },
  gridTextCell: { flex: 1, padding: 6, alignItems: 'center', justifyContent: 'center' },
  gridTextCellBody: { fontSize: 10, color: colors.textSoft, textAlign: 'center' },

  communityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.08)',
  },
  communityRowIcon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  communityRowIconText: { fontSize: 20 },
  communityRowName: { fontSize: 14, color: colors.text, fontWeight: '700' },
  communityRowMeta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },

  // --- Classic self-profile (Seekers, Assistants) ---
  identityBlock: { alignItems: 'center', paddingVertical: 22 },
  name: { fontFamily: serif, fontSize: 22, color: colors.brown, fontWeight: '700' },
  roleBadge: { backgroundColor: colors.creamDark, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, marginTop: 8, overflow: 'visible' },
  roleBadgeText: { fontSize: 11, color: colors.brown, fontWeight: '700', letterSpacing: 0.6 },
  pendingBadge: { backgroundColor: colors.errorBg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 10, overflow: 'visible' },
  pendingBadgeText: { fontSize: 11.5, color: colors.errorText, fontWeight: '700' },

  // --- "Complete your profile" nudge (shown when the optional step was
  // skipped at sign-up and never filled in since) ---
  completeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'stretch',
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 14,
  },
  completeBannerText: { flex: 1, fontSize: 12.5, color: colors.errorText, lineHeight: 17 },
  notifDot: {
    position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: colors.errorText, borderWidth: 1.5, borderColor: colors.white,
  },
  notifDotInline: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.errorText, marginLeft: 6 },

  shadedSection: { backgroundColor: colors.cream, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24 },
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

  // --- Dedication Scorecard (Seekers, Assistants) ---
  scorecardCard: {
    backgroundColor: colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: colors.brownPale, borderStyle: 'dashed',
    padding: 16, marginTop: 4,
  },
  scorecardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scorecardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  scorecardTitle: { fontFamily: serif, fontSize: 15.5, color: colors.brown, fontWeight: '700' },
  comingSoonTag: { backgroundColor: colors.creamDark, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, overflow: 'visible' },
  comingSoonTagText: { fontSize: 9.5, color: colors.brownLight, fontWeight: '700', letterSpacing: 0.4 },
  scorecardBody: { fontSize: 12.5, color: colors.textSoft, lineHeight: 19, marginTop: 10 },
  scorecardStatsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  scorecardStat: { flex: 1, alignItems: 'center', backgroundColor: colors.cream, borderRadius: 10, paddingVertical: 10 },
  scorecardStatValue: { fontSize: 15, color: colors.brownPale, fontWeight: '700' },
  scorecardStatLabel: { fontSize: 9.5, color: colors.textSoft, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // --- Settings sub-screen ---
  settingsSectionLabel: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.brownLight, paddingLeft: 4, marginTop: 16, marginBottom: 6 },
  settingsCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)' },
  settingsRowLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  settingsRowLabel: { fontSize: 13.5, color: colors.text },
  settingsRowLabelDanger: { color: colors.errorText, fontWeight: '700' },
  logOutRow: { alignItems: 'center', paddingVertical: 18 },
  logOutRowText: { color: colors.errorText, fontSize: 13.5, fontWeight: '700' },
});
