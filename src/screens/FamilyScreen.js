import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, serif } from '../theme';
import { fetchMyDirectoryPerson, fetchAuthorsByAuthId } from '../postsApi';
import {
  getOrCreateFamily, fetchMyMembership, fetchFamilyById, withdrawRequest,
} from '../familyApi';
import FamilyMindMapScreen from './FamilyMindMapScreen';
import FamilyMotherPageScreen from './FamilyMotherPageScreen';
import FamilySiblingPageScreen from './FamilySiblingPageScreen';
import FamilyCallPackagesScreen from './FamilyCallPackagesScreen';
import PremiumUpsellScreen from './PremiumUpsellScreen';

// The router for the Family tab. Nothing here is reachable from any other
// tab, so unlike Chat/profile overlays this manages its own small local
// screen stack rather than plugging into HomeTabs' overlay system —
// 'map' (the mind map, the default), 'mother' (the Mother/Pastor's own
// page), 'sibling' (one sibling's shared-update page), 'callPackages'
// (the honest "coming soon" placeholder — no real billing exists yet,
// per Girik's explicit call to skip that this round).
//
// Family formation is a real request-and-accept flow: a Seeker/Assistant
// requests to join from a Mother/Pastor's public profile (see
// PublicProfileScreen), the Mother/Pastor accepts or declines from her
// own mind map's "Requests" view, and up to 6 accepted siblings surround
// her. Only Mothers, Pastors, Seekers, and Assistants have a Family tab
// with real content — Leaders (influencers) aren't part of this system.
export default function FamilyScreen({ session, isPremium, onUpgrade, onFindPeople }) {
  const myAuthId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null); // my own directory_listing row
  const [family, setFamily] = useState(null); // the family I lead, or belong to
  const [leaderName, setLeaderName] = useState(null); // only needed when I'm a sibling
  const [membership, setMembership] = useState(null); // my own membership row (seeker/assistant only)
  const [withdrawing, setWithdrawing] = useState(false);
  const [screen, setScreen] = useState('map');
  const [siblingTarget, setSiblingTarget] = useState(null); // {authId, name}

  const isLeader = me?.role === 'mother' || me?.role === 'pastor';
  const isSibling = me?.role === 'seeker' || me?.role === 'assistant';

  const load = useCallback(async () => {
    setLoading(true);
    setScreen('map');
    try {
      const person = await fetchMyDirectoryPerson(myAuthId);
      setMe(person);

      if (person?.role === 'mother' || person?.role === 'pastor') {
        const fam = await getOrCreateFamily(myAuthId, person.role);
        setFamily(fam);
        setLeaderName(person.name);
        setMembership(null);
      } else if (person?.role === 'seeker' || person?.role === 'assistant') {
        const mem = await fetchMyMembership(myAuthId);
        setMembership(mem);
        if (mem?.status === 'accepted') {
          const fam = await fetchFamilyById(mem.family_id);
          setFamily(fam);
          if (fam?.leader_auth_id) {
            const authors = await fetchAuthorsByAuthId([fam.leader_auth_id]);
            setLeaderName(authors[fam.leader_auth_id]?.name || null);
          }
        } else {
          setFamily(null);
          setLeaderName(null);
        }
      } else {
        setFamily(null);
        setMembership(null);
      }
    } catch (e) {
      // Leaves whatever was already loaded in place rather than blowing up
      // the whole tab — worst case someone sees a stale/empty Family view
      // and can pull to retry via re-opening the tab.
      setFamily(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  }, [myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleWithdraw() {
    if (!membership) return;
    setWithdrawing(true);
    try {
      await withdrawRequest(membership.id);
      setMembership(null);
    } catch (e) {
      // no-op — the membership row just stays as-is; the Withdraw button
      // remains tappable so they can try again.
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  // --- Mother / Pastor ---
  if (isLeader && family) {
    if (screen === 'mother') {
      return (
        <FamilyMotherPageScreen
          session={session}
          family={family}
          isLeader
          leaderName={leaderName}
          onBack={() => setScreen('map')}
          onOpenCallPackages={() => setScreen('callPackages')}
        />
      );
    }
    if (screen === 'sibling' && siblingTarget) {
      return (
        <FamilySiblingPageScreen
          session={session}
          family={family}
          targetAuthId={siblingTarget.authId}
          targetName={siblingTarget.name}
          viewerIsMother
          onBack={() => setScreen('map')}
        />
      );
    }
    if (screen === 'callPackages') {
      return <FamilyCallPackagesScreen leaderName={leaderName} onBack={() => setScreen('mother')} />;
    }
    return (
      <FamilyMindMapScreen
        session={session}
        family={family}
        isLeader
        myLeaderName={leaderName}
        onOpenMotherPage={() => setScreen('mother')}
        onOpenSiblingPage={(m, person) => {
          setSiblingTarget({ authId: m.sibling_auth_id, name: person?.name });
          setScreen('sibling');
        }}
      />
    );
  }

  // --- Seeker / Assistant, no family yet ---
  // Browsing who's out there (Directory, a Mother/Pastor's profile) stays
  // free; actually requesting to join one is the Premium-gated action —
  // same shape as Chat's "replying is free, starting new isn't". A free
  // member sees the Premium upsell here instead of the "browse & request"
  // card; once they upgrade, isPremium flips (via HomeTabs) and this
  // re-renders straight into the real empty state below.
  if (isSibling && !membership) {
    if (!isPremium) {
      return <PremiumUpsellScreen context="family" onUpgrade={onUpgrade} />;
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🌳</Text>
        <Text style={styles.emptyTitle}>Find Your Spiritual Family</Text>
        <Text style={styles.emptyBody}>
          A Spiritual Family gathers you with a Spiritual Mother or Pastor and a small circle of others walking
          alongside her. Visit a Mother or Pastor's profile in the Directory and request to join her family.
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onFindPeople} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Browse the Directory</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Seeker / Assistant, request pending ---
  if (isSibling && membership?.status === 'pending') {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🕊️</Text>
        <Text style={styles.emptyTitle}>Request Pending</Text>
        <Text style={styles.emptyBody}>
          {leaderName
            ? `Your request to join ${leaderName}'s Spiritual Family is waiting on her response.`
            : "Your request to join a Spiritual Family is waiting on a response."}
        </Text>
        <TouchableOpacity style={styles.withdrawBtn} onPress={handleWithdraw} disabled={withdrawing} activeOpacity={0.8}>
          {withdrawing ? (
            <ActivityIndicator color={colors.brown} />
          ) : (
            <Text style={styles.withdrawBtnText}>Withdraw Request</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // --- Seeker / Assistant, accepted ---
  if (isSibling && membership?.status === 'accepted' && family) {
    if (screen === 'mother') {
      return (
        <FamilyMotherPageScreen
          session={session}
          family={family}
          isLeader={false}
          leaderName={leaderName}
          onBack={() => setScreen('map')}
          onOpenCallPackages={() => setScreen('callPackages')}
        />
      );
    }
    if (screen === 'sibling' && siblingTarget) {
      return (
        <FamilySiblingPageScreen
          session={session}
          family={family}
          targetAuthId={siblingTarget.authId}
          targetName={siblingTarget.name}
          viewerIsMother={false}
          onBack={() => setScreen('map')}
        />
      );
    }
    if (screen === 'callPackages') {
      return <FamilyCallPackagesScreen leaderName={leaderName} onBack={() => setScreen('mother')} />;
    }
    return (
      <FamilyMindMapScreen
        session={session}
        family={family}
        isLeader={false}
        myLeaderName={leaderName}
        onOpenMotherPage={() => setScreen('mother')}
        onOpenSiblingPage={(m, person) => {
          setSiblingTarget({ authId: m.sibling_auth_id, name: person?.name });
          setScreen('sibling');
        }}
      />
    );
  }

  // --- Anyone else (Leaders/influencers, or a directory row that failed to load) ---
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>🌳</Text>
      <Text style={styles.emptyTitle}>Spiritual Family</Text>
      <Text style={styles.emptyBody}>
        Spiritual Family is for Spiritual Mothers, Pastors, Seekers, and Assistants — a small circle built around
        one Mother or Pastor at a time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyWrap: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 12 },
  emptyIcon: { fontSize: 36, marginBottom: 14 },
  emptyTitle: { fontFamily: serif, fontSize: 20, color: colors.brown, marginBottom: 8, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14.5, color: colors.textSoft, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, marginTop: 22, overflow: 'visible' },
  emptyBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },
  withdrawBtn: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24,
    marginTop: 22, overflow: 'visible', minWidth: 170, alignItems: 'center',
  },
  withdrawBtnText: { color: colors.brown, fontSize: 14, fontWeight: '700' },
});
