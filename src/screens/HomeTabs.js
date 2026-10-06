import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import ExploreScreen from './ExploreScreen';
import DirectoryScreen from './DirectoryScreen';
import ProfileScreen from './ProfileScreen';
import CreatePostScreen from './CreatePostScreen';
import PostCommentsScreen from './PostCommentsScreen';
import PublicProfileScreen from './PublicProfileScreen';
import ChatListScreen from './ChatListScreen';
import ChatThreadScreen from './ChatThreadScreen';
import PremiumUpsellScreen from './PremiumUpsellScreen';
import FamilyScreen from './FamilyScreen';
import CommunitiesScreen from './CommunitiesScreen';
import CommunityDetailScreen from './CommunityDetailScreen';
import CreateCommunityScreen from './CreateCommunityScreen';
import CreateCommunityPostScreen from './CreateCommunityPostScreen';
import CommunityPostCommentsScreen from './CommunityPostCommentsScreen';
import { fetchIsPremium, upgradeToPremium, findConversationBetween, getOrCreateConversation } from '../chatApi';

// The logged-in home base. No React Navigation here — the whole app already
// switches screens with plain local state (see App.js), so this tab bar
// follows the same pattern rather than pulling in a navigation library.
//
// "overlay" is a tiny ad-hoc navigation stack (one level deep) for the
// screens reachable from more than one tab — a public profile can be
// opened from a Directory card OR a post's author, and comments are
// reachable from a post wherever it's shown (Explore or a profile). When
// set, it replaces whichever tab's content is showing; the tab bar itself
// stays put so backing out or just tapping a different tab both work.
// Outline line-art icons (Ionicons, bundled with Expo) to match the nav bar
// design Girik sent, replacing the earlier emoji icons.
// Communities deliberately has no bottom tab of its own — per Girik's
// instruction, it's reached only two ways: community posts mixed into the
// Explore feed (with a small leaf icon there opening the full browse/
// search/create screen), or a Leader/Mother/Pastor's profile's Communities
// tab.
const TABS = [
  { key: 'explore', icon: 'compass-outline', label: 'Explore' },
  { key: 'directory', icon: 'people-outline', label: 'Directory' },
  { key: 'chat', icon: 'chatbubble-ellipses-outline', label: 'Chat' },
  { key: 'family', icon: 'home-outline', label: 'Family' },
  { key: 'profile', icon: 'person-circle-outline', label: 'Profile' },
];

export default function HomeTabs({ session, onLogOut }) {
  const [tab, setTab] = useState('directory');
  // null | {type:'profile',role,id} | {type:'createPost'} | {type:'comments',postId}
  // | {type:'chatThread',conversation,otherPerson} | {type:'chatUpgrade',person}
  // | {type:'communityDetail',communityId} | {type:'createCommunity'}
  // | {type:'createCommunityPost',communityId,tag} | {type:'communityPostComments',postId}
  // | {type:'communitiesBrowse'}
  const [overlay, setOverlay] = useState(null);
  const [isPremium, setIsPremium] = useState(false);

  const myAuthId = session?.user?.id;

  // Loaded once per session — there's no real billing to poll, the only
  // way this changes is the person tapping "Upgrade to Premium"
  // themselves, which updates this state directly (see handleUpgrade).
  useEffect(() => {
    fetchIsPremium(myAuthId).then(setIsPremium).catch(() => {});
  }, [myAuthId]);

  function selectTab(key) {
    setOverlay(null);
    setTab(key);
  }

  function openProfile(role, id) {
    setOverlay({ type: 'profile', role, id });
  }
  function openComments(postId) {
    setOverlay({ type: 'comments', postId });
  }
  function closeOverlay() {
    setOverlay(null);
  }

  function openCommunity(communityId) {
    setOverlay({ type: 'communityDetail', communityId });
  }
  function openCreateCommunity() {
    setOverlay({ type: 'createCommunity' });
  }
  function openCreateCommunityPost(communityId, tag) {
    setOverlay({ type: 'createCommunityPost', communityId, tag });
  }
  function openCommunityPostComments(postId) {
    setOverlay({ type: 'communityPostComments', postId });
  }
  function openCommunitiesBrowse() {
    setOverlay({ type: 'communitiesBrowse' });
  }

  // No billing exists yet — "upgrading" just flips the flag on this
  // person's own profiles row (see chatApi.upgradeToPremium's comment)
  // and lets whatever they were doing continue.
  async function handleUpgrade() {
    await upgradeToPremium(myAuthId);
    setIsPremium(true);
  }

  function openThread(conversation, otherPerson, initialDraft) {
    setOverlay({ type: 'chatThread', conversation, otherPerson, initialDraft });
  }

  // Reached from a public profile's "Send a message" button, or from one
  // of its Additional Services "Request" buttons (which pass an
  // initialDraft — a pre-filled, editable message — as the second arg).
  // Replying to an existing conversation is always free regardless of
  // Premium status; starting a brand new one is the one place the Premium
  // gate applies. Wrapped in try/catch since this runs un-awaited from a
  // button's onPress — an uncaught rejection here would surface as the
  // same raw crash toast fixed elsewhere in Family (see FamilyScreen etc.).
  async function handleSendMessage(person, initialDraft) {
    if (!person?.auth_user_id || person.auth_user_id === myAuthId) return;
    try {
      const existing = await findConversationBetween(myAuthId, person.auth_user_id);
      if (existing) {
        openThread(existing, { name: person.name, role: person.role }, initialDraft);
        return;
      }
      if (isPremium) {
        const conv = await getOrCreateConversation(myAuthId, person.auth_user_id);
        openThread(conv, { name: person.name, role: person.role }, initialDraft);
      } else {
        setOverlay({ type: 'chatUpgrade', person, initialDraft });
      }
    } catch (e) {
      // No-op — worst case the tap does nothing and they can try again;
      // better than an unhandled rejection crashing the screen.
    }
  }

  let body;
  if (overlay?.type === 'profile') {
    body = (
      <PublicProfileScreen
        role={overlay.role}
        id={overlay.id}
        session={session}
        onBack={closeOverlay}
        onOpenComments={openComments}
        onSendMessage={handleSendMessage}
        onOpenCommunity={openCommunity}
      />
    );
  } else if (overlay?.type === 'chatThread') {
    body = (
      <ChatThreadScreen
        session={session}
        conversation={overlay.conversation}
        otherPerson={overlay.otherPerson}
        initialDraft={overlay.initialDraft}
        onBack={closeOverlay}
      />
    );
  } else if (overlay?.type === 'chatUpgrade') {
    body = (
      <PremiumUpsellScreen
        context="chat"
        targetName={overlay.person?.name}
        onUpgrade={async () => {
          await handleUpgrade();
          const conv = await getOrCreateConversation(myAuthId, overlay.person.auth_user_id);
          openThread(conv, { name: overlay.person.name, role: overlay.person.role }, overlay.initialDraft);
        }}
      />
    );
  } else if (overlay?.type === 'createPost') {
    body = (
      <CreatePostScreen
        session={session}
        onBack={closeOverlay}
        onPosted={closeOverlay}
      />
    );
  } else if (overlay?.type === 'comments') {
    body = (
      <PostCommentsScreen
        postId={overlay.postId}
        session={session}
        onBack={closeOverlay}
      />
    );
  } else if (overlay?.type === 'communityDetail') {
    body = (
      <CommunityDetailScreen
        communityId={overlay.communityId}
        session={session}
        onBack={closeOverlay}
        onCreatePost={openCreateCommunityPost}
        onOpenComments={openCommunityPostComments}
      />
    );
  } else if (overlay?.type === 'createCommunity') {
    body = (
      <CreateCommunityScreen
        session={session}
        onBack={closeOverlay}
        onCreated={(id) => openCommunity(id)}
      />
    );
  } else if (overlay?.type === 'createCommunityPost') {
    body = (
      <CreateCommunityPostScreen
        communityId={overlay.communityId}
        initialTag={overlay.tag}
        session={session}
        onBack={closeOverlay}
        onPosted={() => openCommunity(overlay.communityId)}
      />
    );
  } else if (overlay?.type === 'communityPostComments') {
    body = (
      <CommunityPostCommentsScreen
        postId={overlay.postId}
        session={session}
        onBack={closeOverlay}
      />
    );
  } else if (overlay?.type === 'communitiesBrowse') {
    body = (
      <CommunitiesScreen
        session={session}
        onBack={closeOverlay}
        onOpenCommunity={openCommunity}
        onCreateCommunity={openCreateCommunity}
      />
    );
  } else if (tab === 'explore') {
    body = (
      <ExploreScreen
        session={session}
        onOpenAuthor={openProfile}
        onOpenComments={openComments}
        onCreatePost={() => setOverlay({ type: 'createPost' })}
        onSearchPeople={() => selectTab('directory')}
        onOpenCommunity={openCommunity}
        onOpenCommunityComments={openCommunityPostComments}
        onBrowseCommunities={openCommunitiesBrowse}
      />
    );
  } else if (tab === 'directory') {
    body = <DirectoryScreen onOpenProfile={openProfile} />;
  } else if (tab === 'chat') {
    body = (
      <ChatListScreen
        session={session}
        isPremium={isPremium}
        onOpenThread={openThread}
        onUpgrade={handleUpgrade}
        onFindPeople={() => selectTab('directory')}
      />
    );
  } else if (tab === 'family') {
    body = (
      <FamilyScreen
        session={session}
        isPremium={isPremium}
        onUpgrade={handleUpgrade}
        onFindPeople={() => selectTab('directory')}
      />
    );
  } else {
    body = (
      <ProfileScreen
        session={session}
        onLogOut={onLogOut}
        onCreatePost={() => setOverlay({ type: 'createPost' })}
        onOpenComments={openComments}
        onOpenCommunity={openCommunity}
        onCreateCommunity={openCreateCommunity}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.content}>{body}</View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          // Opening a profile (or anything else reachable from more than
          // one tab) doesn't change `tab` itself — it's still whichever
          // tab you were actually on when you opened it — so highlighting
          // should follow `tab` regardless of whether an overlay is up.
          // This used to gate on `!overlay`, which meant Directory (or
          // Explore) went dark the moment you opened someone's profile
          // from it, even though you were still very much "in" that tab.
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => selectTab(t.key)}>
              <Ionicons
                name={t.icon}
                size={22}
                color={active ? colors.brown : colors.textSoft}
                style={!active && styles.tabIconInactive}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, minHeight: 420 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(107,66,38,0.12)',
    marginTop: 16,
    paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIconInactive: { opacity: 0.7 },
  tabLabel: { fontSize: 11, color: colors.textSoft, marginTop: 2 },
  tabLabelActive: { color: colors.brown, fontWeight: '700' },
});
