import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import { supabase } from '../supabaseClient';
import { fetchSignedUrls } from '../postsApi';
import { fetchPendingRealFamilyInvites, inviteToRealFamily, removeRealFamilyMember } from '../realFamilyApi';

// Reached from the owner-only person-add icon on RealFamilyMindMapScreen.
// Two views: a list of invites already sent (cancel any of them), and a
// "+ Invite Someone" flow that searches the Directory directly — there's
// no public "request to join" card the way Spiritual Family has, since a
// real family is formed by the owner reaching out, not by someone finding
// a profile and applying.
export default function RealFamilyInviteScreen({ family, existingAuthIds, onBack, onInvited }) {
  const [step, setStep] = useState('list'); // 'list' | 'pick'
  const [pending, setPending] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [people, setPeople] = useState({});
  const [avatarUrls, setAvatarUrls] = useState({});

  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // directory_listing row
  const [relationship, setRelationship] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    const rows = await fetchPendingRealFamilyInvites(family.id);
    setPending(rows);
    if (rows.length) {
      const { data } = await supabase
        .from('directory_listing')
        .select('auth_user_id, name, profile_picture_path')
        .in('auth_user_id', rows.map((r) => r.member_auth_id));
      const map = {};
      (data || []).forEach((p) => { map[p.auth_user_id] = p; });
      setPeople(map);
      const paths = (data || []).map((p) => p.profile_picture_path).filter(Boolean);
      setAvatarUrls(await fetchSignedUrls('profile-pictures', paths));
    }
    setLoadingList(false);
  }, [family.id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (step !== 'pick') return;
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('directory_listing')
        .select('auth_user_id, name, role, profile_picture_path')
        .ilike('name', `%${q}%`)
        .limit(20);
      if (cancelled) return;
      const excluded = new Set(existingAuthIds || []);
      setResults((data || []).filter((p) => !excluded.has(p.auth_user_id)));
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, step, existingAuthIds]);

  function startPick() {
    setSearch('');
    setResults([]);
    setSelected(null);
    setRelationship('');
    setError(null);
    setStep('pick');
  }

  async function handleCancelInvite(membershipId) {
    setPending((prev) => prev.filter((p) => p.id !== membershipId));
    try {
      await removeRealFamilyMember(membershipId);
    } catch (e) {
      loadList();
    }
  }

  async function handleSendInvite() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      await inviteToRealFamily(family.id, selected.auth_user_id, relationship);
      setStep('list');
      await loadList();
      onInvited?.();
    } catch (e) {
      setError('Couldn’t send that invite right now. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (step === 'pick') {
    return (
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setStep('list')} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.brown} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invite Someone</Text>
          <View style={styles.headerBtn} />
        </View>

        {!selected ? (
          <>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={15} color={colors.textSoft} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search the Directory by name…"
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
              />
            </View>
            {searching ? (
              <ActivityIndicator color={colors.brown} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.auth_user_id}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  search.trim() ? <Text style={styles.emptyText}>No one matches that search.</Text> : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultRow} activeOpacity={0.7} onPress={() => setSelected(item)}>
                    <View style={styles.resultAvatar}>
                      <Text style={styles.resultAvatarText}>{initialsFor(item.name)}</Text>
                    </View>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name || 'Unnamed'}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSoft} />
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        ) : (
          <View style={styles.pickedCard}>
            <Text style={styles.pickedName}>{selected.name || 'Unnamed'}</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Relationship (optional)</Text>
            <TextInput
              style={styles.input}
              value={relationship}
              onChangeText={setRelationship}
              placeholder="e.g. Mother, Father, Son, Daughter, Spouse"
              placeholderTextColor={colors.textSoft}
            />

            <View style={styles.pickedNav}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setSelected(null)} disabled={sending}>
                <Text style={styles.ghostBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, sending && styles.btnDisabled]} onPress={handleSendInvite} disabled={sending}>
                <Text style={styles.btnText}>{sending ? 'Sending…' : 'Send Invite'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.brown} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invites Sent</Text>
        <View style={styles.headerBtn} />
      </View>

      <TouchableOpacity style={styles.inviteBtn} onPress={startPick} activeOpacity={0.8}>
        <Ionicons name="person-add" size={16} color={colors.white} />
        <Text style={styles.inviteBtnText}>Invite Someone</Text>
      </TouchableOpacity>

      {loadingList ? (
        <ActivityIndicator color={colors.brown} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 14 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No pending invites right now.</Text>}
          renderItem={({ item }) => {
            const person = people[item.member_auth_id];
            const avatarUrl = person?.profile_picture_path ? avatarUrls[person.profile_picture_path] : null;
            return (
              <View style={styles.pendingRow}>
                <View style={styles.resultAvatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.resultAvatarImg} />
                  ) : (
                    <Text style={styles.resultAvatarText}>{initialsFor(person?.name)}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{person?.name || 'Member'}</Text>
                  <Text style={styles.pendingMeta}>{item.relationship || 'Invited'} · awaiting response</Text>
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelInvite(item.id)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  headerBtn: { width: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 24 },

  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 12, marginTop: 14,
  },
  inviteBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },

  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white,
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14, padding: 13, marginBottom: 10,
  },
  pendingMeta: { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  cancelBtn: { borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  cancelBtnText: { fontSize: 12, color: colors.brown, fontWeight: '700' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.creamDark,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginTop: 14, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.text, padding: 0 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.08)',
  },
  resultAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  resultAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  resultAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 13, color: colors.brown },
  resultName: { flex: 1, fontSize: 14.5, color: colors.text, fontWeight: '700' },

  pickedCard: { marginTop: 18 },
  pickedName: { fontFamily: serif, fontSize: 19, color: colors.brown, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13.5, fontWeight: '600', color: colors.brown, marginBottom: 6 },
  input: {
    fontSize: 15, padding: 13, borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.25)', backgroundColor: colors.white, color: colors.text,
  },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 14,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  pickedNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  btn: { backgroundColor: colors.brown, paddingVertical: 13, paddingHorizontal: 26, borderRadius: 999 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  ghostBtnText: { color: colors.brown, fontSize: 15, fontWeight: '600' },
});
