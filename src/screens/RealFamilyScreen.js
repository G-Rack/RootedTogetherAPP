import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, Platform,
} from 'react-native';
import { colors, serif } from '../theme';
import {
  fetchRealFamilyByOwner, fetchRealFamilyById, createRealFamily, fetchMyRealFamilyMembership,
  acceptRealFamilyInvite, removeRealFamilyMember, fetchRealFamilyMembers,
} from '../realFamilyApi';
import { fetchAuthorsByAuthId } from '../postsApi';
import RealFamilyMindMapScreen from './RealFamilyMindMapScreen';
import RealFamilyInviteScreen from './RealFamilyInviteScreen';
import RealFamilyMemberPageScreen from './RealFamilyMemberPageScreen';
import RealFamilyGroupChatScreen from './RealFamilyGroupChatScreen';

// The "My Family" side of the Family tab — a separate, parallel router
// from the Spiritual Family one above it in FamilyScreen.js, for a
// person's actual biological/legal family. Open to every role: you either
// own a real family (you created it and can invite into it), belong to
// one as an accepted member, have a pending invite waiting on you, or
// have neither yet (and can create your own). Unlike Spiritual Family,
// owning your own real family and having a membership row in someone
// else's aren't mutually exclusive — this screen just prioritizes showing
// your own (if you have one) over a membership elsewhere.
export default function RealFamilyScreen({ session, sectionToggle }) {
  const myAuthId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState(null); // real_families row I own, if any
  const [membership, setMembership] = useState(null); // my own pending/accepted row elsewhere, if any
  const [memberFamily, setMemberFamily] = useState(null); // the real_families row that membership belongs to
  const [ownerName, setOwnerName] = useState(null);
  const [creating, setCreating] = useState(false);
  const [familyNameDraft, setFamilyNameDraft] = useState('');
  const [createError, setCreateError] = useState(null);
  const [respondBusy, setRespondBusy] = useState(false);
  const [screen, setScreen] = useState('map'); // 'map' | 'invite' | 'memberPage' | 'groupChat' | 'create'
  const [memberTarget, setMemberTarget] = useState(null); // {membership, authId, name}
  const [existingAuthIds, setExistingAuthIds] = useState([]); // accepted + pending, for the invite search's exclude list

  const load = useCallback(async () => {
    setLoading(true);
    setScreen('map');
    try {
      const mine = await fetchRealFamilyByOwner(myAuthId);
      setOwned(mine);
      if (!mine) {
        const mem = await fetchMyRealFamilyMembership(myAuthId);
        setMembership(mem);
        if (mem) {
          const fam = await fetchRealFamilyById(mem.family_id);
          setMemberFamily(fam);
          if (fam?.owner_auth_id) {
            const authors = await fetchAuthorsByAuthId([fam.owner_auth_id]);
            setOwnerName(authors[fam.owner_auth_id]?.name || null);
          }
        } else {
          setMemberFamily(null);
          setOwnerName(null);
        }
      } else {
        setMembership(null);
        setMemberFamily(null);
      }
    } catch (e) {
      setOwned(null);
      setMembership(null);
      setMemberFamily(null);
    } finally {
      setLoading(false);
    }
  }, [myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeFamily = owned || memberFamily;
  const isOwner = !!owned;

  // Kept up to date whenever the mind map's underlying membership list
  // could have changed, so the invite screen's search excludes people
  // already invited or already in — refreshed on every return to 'map'.
  const refreshExistingIds = useCallback(async () => {
    if (!activeFamily) return;
    const [accepted, mem] = await Promise.all([
      fetchRealFamilyMembers(activeFamily.id),
      Promise.resolve(null),
    ]);
    const ids = new Set([activeFamily.owner_auth_id, ...accepted.map((m) => m.member_auth_id)]);
    setExistingAuthIds([...ids]);
  }, [activeFamily]);

  useEffect(() => {
    if (activeFamily) refreshExistingIds();
  }, [activeFamily, refreshExistingIds]);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const fam = await createRealFamily(myAuthId, familyNameDraft);
      setOwned(fam);
      setScreen('map');
    } catch (e) {
      setCreateError('Couldn’t create your family right now. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleAcceptInvite() {
    if (!membership) return;
    setRespondBusy(true);
    try {
      const acceptedCount = (await fetchRealFamilyMembers(membership.family_id)).length;
      await acceptRealFamilyInvite(membership, acceptedCount);
      load();
    } catch (e) {
      setRespondBusy(false);
    }
  }

  async function handleDeclineInvite() {
    if (!membership) return;
    setRespondBusy(true);
    try {
      await removeRealFamilyMember(membership.id);
      setMembership(null);
      setMemberFamily(null);
    } catch (e) {
      // leave it tappable to retry
    } finally {
      setRespondBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.wrap}>
        {sectionToggle}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      </View>
    );
  }

  // --- Sub-screens, reachable from either an owner's or a member's map ---
  if (screen === 'invite' && isOwner && activeFamily) {
    return (
      <RealFamilyInviteScreen
        family={activeFamily}
        existingAuthIds={existingAuthIds}
        onBack={() => setScreen('map')}
        onInvited={refreshExistingIds}
      />
    );
  }

  if (screen === 'memberPage' && memberTarget && activeFamily) {
    return (
      <RealFamilyMemberPageScreen
        membership={memberTarget.membership}
        targetAuthId={memberTarget.authId}
        targetName={memberTarget.name}
        isOwner={isOwner}
        onBack={() => setScreen('map')}
        onRemoved={() => {
          setScreen('map');
          load();
        }}
      />
    );
  }

  if (screen === 'groupChat' && activeFamily) {
    return (
      <RealFamilyGroupChatScreen
        session={session}
        family={activeFamily}
        isOwner={isOwner}
        ownerName={isOwner ? null : ownerName}
        onBack={() => setScreen('map')}
      />
    );
  }

  // --- Top-level states (toggle shown on all of these) ---

  if (screen === 'create') {
    return (
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.wrap}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              {sectionToggle}
              <View style={styles.createWrap}>
                <Text style={styles.createIcon}>🏡</Text>
                <Text style={styles.createTitle}>Name Your Family</Text>
                <Text style={styles.createBody}>
                  Give your family a name — you can always change it later. Once it's created, you can invite anyone
                  from the Directory to join.
                </Text>
                {createError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{createError}</Text>
                  </View>
                ) : null}
                <TextInput
                  style={styles.input}
                  value={familyNameDraft}
                  onChangeText={setFamilyNameDraft}
                  placeholder="e.g. The Smith Family"
                  placeholderTextColor={colors.textSoft}
                />
                <View style={styles.createNav}>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => setScreen('map')} disabled={creating}>
                    <Text style={styles.ghostBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, creating && styles.btnDisabled]} onPress={handleCreate} disabled={creating}>
                    <Text style={styles.btnText}>{creating ? 'Creating…' : 'Create'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (owned) {
    return (
      <View style={styles.wrap}>
        {sectionToggle}
        <RealFamilyMindMapScreen
          session={session}
          family={owned}
          isOwner
          onOpenGroupChat={() => setScreen('groupChat')}
          onOpenInvite={() => setScreen('invite')}
          onOpenMemberPage={(m, person) => {
            setMemberTarget({ membership: m, authId: m.member_auth_id, name: person?.name });
            setScreen('memberPage');
          }}
        />
      </View>
    );
  }

  if (membership?.status === 'pending' && memberFamily) {
    return (
      <View style={styles.wrap}>
        {sectionToggle}
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>💌</Text>
          <Text style={styles.emptyTitle}>Family Invite</Text>
          <Text style={styles.emptyBody}>
            {ownerName ? `${ownerName} has invited you to join ` : 'You’ve been invited to join '}
            {memberFamily.family_name || 'their family'}
            {membership.relationship ? ` as their ${membership.relationship}` : ''}.
          </Text>
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.declineInviteBtn} onPress={handleDeclineInvite} disabled={respondBusy} activeOpacity={0.8}>
              <Text style={styles.declineInviteBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptInviteBtn} onPress={handleAcceptInvite} disabled={respondBusy} activeOpacity={0.8}>
              {respondBusy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.acceptInviteBtnText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (membership?.status === 'accepted' && memberFamily) {
    return (
      <View style={styles.wrap}>
        {sectionToggle}
        <RealFamilyMindMapScreen
          session={session}
          family={memberFamily}
          isOwner={false}
          ownerName={ownerName}
          onOpenGroupChat={() => setScreen('groupChat')}
          onOpenMemberPage={(m, person) => {
            setMemberTarget({ membership: m, authId: m.member_auth_id, name: person?.name });
            setScreen('memberPage');
          }}
        />
      </View>
    );
  }

  // --- No real family yet, either way ---
  return (
    <View style={styles.wrap}>
      {sectionToggle}
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyIcon}>🏡</Text>
        <Text style={styles.emptyTitle}>Your Family</Text>
        <Text style={styles.emptyBody}>
          A space for your own family — parents, kids, spouses, whoever belongs together. Create yours and invite
          people in, the same way a Spiritual Family works above, just for the family you already have.
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => { setFamilyNameDraft(''); setCreateError(null); setScreen('create'); }} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Create Your Family</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  emptyWrap: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 12 },
  emptyIcon: { fontSize: 36, marginBottom: 14 },
  emptyTitle: { fontFamily: serif, fontSize: 20, color: colors.brown, marginBottom: 8, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14.5, color: colors.textSoft, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 13, paddingHorizontal: 26, marginTop: 22, overflow: 'visible' },
  emptyBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '700' },

  inviteActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  declineInviteBtn: { borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22 },
  declineInviteBtnText: { color: colors.brown, fontSize: 14, fontWeight: '700' },
  acceptInviteBtn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 26, minWidth: 100, alignItems: 'center' },
  acceptInviteBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },

  createWrap: { paddingTop: 30, paddingHorizontal: 4 },
  createIcon: { fontSize: 36, textAlign: 'center', marginBottom: 14 },
  createTitle: { fontFamily: serif, fontSize: 20, color: colors.brown, marginBottom: 8, fontWeight: '700', textAlign: 'center' },
  createBody: { fontSize: 14.5, color: colors.textSoft, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  input: {
    fontSize: 15, padding: 13, borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.25)', backgroundColor: colors.white, color: colors.text,
  },
  createNav: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 24 },
  btn: { backgroundColor: colors.brown, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 999 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  ghostBtnText: { color: colors.brown, fontSize: 15, fontWeight: '600' },
});
