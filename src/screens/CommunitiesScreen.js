import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { fetchCommunities, fetchMyMembershipMap, joinCommunity, leaveCommunity, getCommunityImageUrl } from '../communitiesApi';
import { fetchMyDirectoryPerson } from '../postsApi';

function formatMembers(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K members`;
  return `${n} ${n === 1 ? 'member' : 'members'}`;
}

// Starting a community is a Spiritual Leader / Mother / Pastor thing —
// same roles that get the Instagram-style profile and can post in Explore
// (see FOLLOWABLE_ROLES in ProfileScreen.js). Seekers/Assistants can join
// and take part in any community, just not create one.
const CAN_CREATE_ROLES = ['influencer', 'mother', 'pastor'];

// The Communities directory — a Facebook-Marketplace-style browsable grid
// of topic communities (Grief, Family Estrangement, Parenting, ...) rather
// than a feed. Anyone signed in can browse or join; only Leaders/Mothers/
// Pastors can start one (the "+" button is hidden for everyone else), and
// only current members can post inside a community (see
// CommunityDetailScreen).
export default function CommunitiesScreen({ session, onOpenCommunity, onCreateCommunity, onBack }) {
  const [communities, setCommunities] = useState(null); // null = loading
  const [joined, setJoined] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [canCreate, setCanCreate] = useState(false);

  const myAuthId = session?.user?.id;

  const load = useCallback(async () => {
    try {
      const data = await fetchCommunities();
      setCommunities(data);
      const map = await fetchMyMembershipMap(data.map((c) => c.id), myAuthId);
      setJoined(map);
    } catch (e) {
      setError('Couldn’t load communities right now. Pull down to try again.');
      setCommunities([]);
    }
  }, [myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const person = await fetchMyDirectoryPerson(myAuthId);
      if (!cancelled) setCanCreate(!!person && CAN_CREATE_ROLES.includes(person.role));
    })();
    return () => { cancelled = true; };
  }, [myAuthId]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleToggleJoin(id) {
    const was = !!joined[id];
    setJoined((m) => ({ ...m, [id]: !was }));
    setBusyId(id);
    try {
      if (was) await leaveCommunity(id, myAuthId);
      else await joinCommunity(id, myAuthId);
      setCommunities((list) => list.map((c) => (
        c.id === id ? { ...c, member_count: Math.max(0, c.member_count + (was ? -1 : 1)) } : c
      )));
    } catch (e) {
      setJoined((m) => ({ ...m, [id]: was }));
    } finally {
      setBusyId(null);
    }
  }

  const topicChips = useMemo(() => {
    if (!communities) return ['All', 'Joined'];
    const topics = [...new Set(communities.map((c) => c.topic).filter(Boolean))];
    return ['All', 'Joined', ...topics];
  }, [communities]);

  const visible = useMemo(() => {
    if (!communities) return [];
    let list = communities;
    if (filter === 'Joined') list = list.filter((c) => joined[c.id]);
    else if (filter !== 'All') list = list.filter((c) => c.topic === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q));
    return list;
  }, [communities, filter, joined, search]);

  if (communities === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.header, onBack && styles.headerWithBack]}>Communities</Text>
        {canCreate ? (
          <TouchableOpacity style={styles.addBtn} onPress={onCreateCommunity} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color={colors.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.addBtnSpacer} />
        )}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={15} color={colors.textSoft} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search communities…"
          placeholderTextColor={colors.textSoft}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={topicChips}
        keyExtractor={(item) => item}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, filter === item && styles.filterChipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterChipText, filter === item && styles.filterChipTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brown} />}
        contentContainerStyle={visible.length === 0 ? { flexGrow: 1 } : { paddingBottom: 20 }}
        ListEmptyComponent={
          !error ? (
            <Text style={styles.emptyText}>
              {search.trim() ? 'No communities match that search.' : filter === 'Joined' ? 'You haven’t joined any communities yet.' : 'No communities yet — be the first to start one.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isJoined = !!joined[item.id];
          return (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => onOpenCommunity(item.id)}>
              <View style={styles.cardTile}>
                {item.image_path ? (
                  <Image source={{ uri: getCommunityImageUrl(item.image_path) }} style={styles.cardTileImage} />
                ) : (
                  <Text style={styles.cardTileIcon}>{item.icon}</Text>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.cardMeta}>{formatMembers(item.member_count)}</Text>
                <TouchableOpacity
                  style={[styles.joinBtn, isJoined && styles.joinBtnJoined]}
                  onPress={() => handleToggleJoin(item.id)}
                  disabled={busyId === item.id}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.joinBtnText, isJoined && styles.joinBtnTextJoined]}>{isJoined ? 'Joined' : 'Join'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 },
  header: { fontFamily: serif, fontSize: 24, color: colors.brown, fontWeight: '700' },
  headerWithBack: { flex: 1 },
  backBtn: { width: 26 },
  backChevron: { fontSize: 26, color: colors.brown, fontWeight: '700' },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  addBtnSpacer: { width: 34, height: 34 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.creamDark,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  filterRow: { marginHorizontal: -24, marginBottom: 14, flexGrow: 0 },
  filterRowContent: { flexDirection: 'row', paddingHorizontal: 24, gap: 8 },
  filterChip: {
    paddingVertical: 8, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1.5,
    borderColor: colors.brownPale, backgroundColor: colors.white, overflow: 'visible',
  },
  filterChipActive: { backgroundColor: colors.brown, borderColor: colors.brown },
  filterChipText: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  filterChipTextActive: { color: colors.white },
  errorBox: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 40, paddingHorizontal: 30 },
  gridRow: { gap: 12 },
  card: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    overflow: 'hidden', backgroundColor: colors.white, marginBottom: 12,
  },
  cardTile: { height: 74, backgroundColor: colors.creamDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardTileImage: { width: '100%', height: '100%' },
  cardTileIcon: { fontSize: 28 },
  cardBody: { padding: 10 },
  cardName: { fontSize: 13.5, fontWeight: '700', color: colors.text, lineHeight: 17, marginBottom: 3 },
  cardDesc: { fontSize: 11, color: colors.textSoft, lineHeight: 14, marginBottom: 8, minHeight: 28 },
  cardMeta: { fontSize: 10.5, color: colors.textSoft, marginBottom: 8 },
  joinBtn: { textAlign: 'center', paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: colors.brown, alignItems: 'center', overflow: 'visible' },
  joinBtnJoined: { backgroundColor: colors.brown },
  joinBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.brown },
  joinBtnTextJoined: { color: colors.white },
});
