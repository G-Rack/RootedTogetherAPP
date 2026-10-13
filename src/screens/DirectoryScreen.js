import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import { ROLE_LABELS, initialsFor } from '../roleLabels';

// v1 scope, per the answers we settled on before building this:
//   - Everyone sees everyone (no role-based visibility restrictions)
//   - People still "Needs Vetting" are shown too, just labeled as pending
//   - A search box (name + focus areas) plus a row of filter pills —
//     redesigned to match the reference screens Girik sent: All / Seekers /
//     Mothers / Pastors / Assistants, filled-pill style, horizontally
//     scrollable (the last pill is meant to peek off the edge as a "there's
//     more, scroll" hint — that's the design, not the old cut-off bug).
//     Note: this pill ORDER matches the reference image, which is different
//     from the "All, Mothers, Pastors, Assistants, Seekers" order asked for
//     earlier — flagged for Girik in case that was meant to stay.
//   - Each card now shows a role badge next to the name and a one-line
//     summary (focus area / faith tradition / experience, whichever the
//     role actually has) instead of just the plain role label, plus a
//     chevron hinting the row opens their profile.
//
// The data comes from the `directory_listing` Postgres view rather than the
// five role tables directly. It used to expose only the bare basics (name,
// photo, vetting status); it now also exposes each person's story, faith
// tradition, years of experience, capacity (Mothers only), and focus areas
// — needed for the redesigned profile screen and this search box — see the
// "Directory" section of Supabase_Backend_Guide.md for exactly what that
// added and the trade-off worth knowing about.

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'seeker', label: 'Seekers' },
  { key: 'mother', label: 'Mothers' },
  { key: 'pastor', label: 'Pastors' },
  { key: 'church', label: 'Churches' },
  { key: 'assistant', label: 'Assistants' },
];

// A short one-line summary for a card, built only from fields that role
// actually has (nothing invented) — closest real-data equivalent of the
// descriptive line in the reference design.
function summaryFor(person) {
  const parts = [];
  if (person.focus_areas && person.focus_areas.length) parts.push(person.focus_areas[0]);
  if (person.faith_tradition) parts.push(person.faith_tradition);
  if (person.years_experience) parts.push(`${person.years_experience} experience`);
  if (!parts.length) return ROLE_LABELS[person.role] || person.role;
  return parts.join(' · ');
}

export default function DirectoryScreen({ onOpenProfile }) {
  const [people, setPeople] = useState(null); // null = still loading
  const [avatarUrls, setAvatarUrls] = useState({}); // path -> signed url
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Girik's second screen recording proved the previous fix wrong: it
  // showed EVERY filter pill — not just the selected one, and regardless
  // of whether it had a solid brown background or a plain white/bordered
  // one — rendering with only the top sliver of each letter for the first
  // couple of seconds after this screen mounts, then suddenly rendering
  // perfectly a couple of taps later. That rules out the corner-radius
  // clipping-mask theory from last round (adding `overflow: 'visible'`
  // made no visible difference in the new recording, exactly as you'd
  // expect if there was never a clipping mask to remove). What's actually
  // happening is a first-paint text-measurement race on iOS itself: the
  // very first layout pass sizes and draws the text into a too-short box,
  // and only a later native re-layout draws it at full height. The
  // recording shows real re-renders (tapping a different filter) are what
  // fixes it — so instead of waiting for a person to tap around, force a
  // few harmless extra re-layouts automatically, right after this screen
  // mounts, by briefly changing each pill's key. That remounts the native
  // view a few times in the first half-second, which should settle the
  // text before anyone has had time to actually read it.
  const [pillRelayoutTick, setPillRelayoutTick] = useState(0);
  useEffect(() => {
    const delays = [50, 200, 450, 800];
    const timers = delays.map((delay, i) => setTimeout(() => setPillRelayoutTick(i + 1), delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('directory_listing')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('Couldn’t load the directory right now. Pull down to try again.');
      setPeople([]);
      return;
    }

    setPeople(data || []);

    // Profile pictures live in a private storage bucket, so a plain public
    // URL won't work — batch-request short-lived signed URLs for every
    // picture this screen actually needs to show, one request instead of
    // one per row.
    const paths = (data || [])
      .map((p) => p.profile_picture_path)
      .filter(Boolean);
    if (paths.length) {
      const { data: signed, error: signError } = await supabase
        .storage
        .from('profile-pictures')
        .createSignedUrls(paths, 60 * 60); // 1 hour — plenty for one screen visit
      if (!signError && signed) {
        const map = {};
        signed.forEach((s) => {
          if (s.signedUrl) map[s.path] = s.signedUrl;
        });
        setAvatarUrls(map);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filteredPeople = useMemo(() => {
    if (!people) return [];
    let list = filter === 'all' ? people : people.filter((p) => p.role === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        if (p.name && p.name.toLowerCase().includes(q)) return true;
        if (p.focus_areas && p.focus_areas.some((f) => f.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return list;
  }, [people, filter, search]);

  if (people === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.header}>Directory</Text>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or focus…"
          placeholderTextColor={colors.textSoft}
          allowFontScaling={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={`${f.key}-${pillRelayoutTick}`}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]} allowFontScaling={false}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredPeople}
        keyExtractor={(item) => `${item.role}-${item.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brown} />}
        ListEmptyComponent={
          !error ? (
            <Text style={styles.emptyText}>
              {search.trim() ? 'No one matches that search.' : filter === 'all' ? 'No one’s here yet — check back soon.' : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} yet.`}
            </Text>
          ) : null
        }
        contentContainerStyle={filteredPeople.length === 0 ? { flexGrow: 1 } : { paddingBottom: 12 }}
        renderItem={({ item }) => {
          const avatarUrl = item.profile_picture_path ? avatarUrls[item.profile_picture_path] : null;
          const pending = item.vetting_status === 'Needs Vetting';
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => onOpenProfile && onOpenProfile(item.role, item.id)}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{initialsFor(item.name)}</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.name || 'Unnamed'}</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{(ROLE_LABELS[item.role] || item.role).replace('Spiritual ', '').replace('Priest / ', '').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.summary} numberOfLines={1}>{summaryFor(item)}</Text>
                {pending && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
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
  header: { fontFamily: serif, fontSize: 24, color: colors.brown, fontWeight: '700', marginBottom: 14 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.creamDark,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.6 },
  searchInput: { flex: 1, fontSize: 14.5, color: colors.text, padding: 0 },
  filterRow: {
    marginHorizontal: -24,
    marginBottom: 14,
    flexGrow: 0,
  },
  filterRowContent: { flexDirection: 'row', paddingHorizontal: 24, gap: 8 },
  filterPill: {
    // `overflow: 'visible'` stays here as cheap insurance (never hurts on a
    // shape whose padding already keeps text well inside it), but it was
    // NOT the real fix for the clipped-text bug — see the pillRelayoutTick
    // comment above `useState` for what the actual cause turned out to be
    // and how it's actually fixed (forcing a few early re-layouts).
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999,
    borderWidth: 1, borderColor: colors.brownPale, backgroundColor: colors.white,
    overflow: 'visible',
  },
  filterPillActive: { backgroundColor: colors.brown, borderColor: colors.brown },
  filterPillText: { fontSize: 13.5, lineHeight: 18, color: colors.brown, fontWeight: '700' },
  filterPillTextActive: { color: colors.white },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.creamDark },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 15 },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  name: { fontSize: 15.5, color: colors.text, fontWeight: '700', marginRight: 8 },
  roleBadge: { backgroundColor: colors.creamDark, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, overflow: 'visible' },
  roleBadgeText: { fontSize: 9.5, color: colors.brown, fontWeight: '700', letterSpacing: 0.3 },
  summary: { fontSize: 13, color: colors.textSoft, marginTop: 3 },
  pendingBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.creamDark, borderRadius: 999,
    paddingVertical: 3, paddingHorizontal: 9, marginTop: 6, overflow: 'visible',
  },
  pendingBadgeText: { fontSize: 11, color: colors.brownLight, fontWeight: '700' },
  chevron: { fontSize: 22, color: colors.brownPale, marginLeft: 2 },
});
