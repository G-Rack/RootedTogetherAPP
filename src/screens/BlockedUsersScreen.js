import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, serif } from '../theme';
import { fetchMyBlockedUsers, unblockUser } from '../moderationApi';
import { fetchAuthorsByAuthId } from '../postsApi';
import { ROLE_LABELS, initialsFor } from '../roleLabels';

// Profile → Blocked users. Lists everyone the signed-in person has blocked
// with an Unblock button, so a block is never a one-way door.
export default function BlockedUsersScreen({ onBack }) {
  const [rows, setRows] = useState(null); // null = loading
  const [people, setPeople] = useState({});
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchMyBlockedUsers();
      setRows(data);
      setPeople(await fetchAuthorsByAuthId(data.map((r) => r.blocked_auth_id)));
    } catch (e) {
      setError('Couldn’t load your blocked users right now.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function confirmUnblock(authId, name) {
    Alert.alert(`Unblock ${name}?`, 'They’ll be able to see your posts and message you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setBusyId(authId);
          try {
            await unblockUser(authId);
            setRows((current) => (current || []).filter((r) => r.blocked_auth_id !== authId));
          } catch (e) {
            setError('Couldn’t unblock right now. Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLinkText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.header}>Blocked users</Text>
      <Text style={styles.sub}>
        People you block can’t message you, and you won’t see their posts or comments.
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {rows === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.blocked_auth_id}
          ListEmptyComponent={!error ? <Text style={styles.emptyText}>You haven’t blocked anyone.</Text> : null}
          renderItem={({ item }) => {
            const person = people[item.blocked_auth_id];
            const name = person?.name || 'Member';
            return (
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsFor(person?.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{name}</Text>
                  {person?.role ? <Text style={styles.role}>{ROLE_LABELS[person.role] || person.role}</Text> : null}
                </View>
                <TouchableOpacity
                  style={[styles.unblockBtn, busyId === item.blocked_auth_id && { opacity: 0.5 }]}
                  onPress={() => confirmUnblock(item.blocked_auth_id, name)}
                  disabled={busyId === item.blocked_auth_id}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
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
  backLinkText: { color: colors.brown, fontSize: 14.5, fontWeight: '600', marginBottom: 8 },
  header: { fontFamily: serif, fontSize: 26, color: colors.brown, fontWeight: '700' },
  sub: { fontSize: 13.5, color: colors.textSoft, lineHeight: 19, marginTop: 6, marginBottom: 16 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 40 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 12,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.08)',
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.brown, fontWeight: '700', fontSize: 13 },
  name: { fontSize: 14.5, color: colors.text, fontWeight: '700' },
  role: { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  unblockBtn: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 999,
    paddingVertical: 7, paddingHorizontal: 14, overflow: 'visible',
  },
  unblockText: { fontSize: 12.5, color: colors.brown, fontWeight: '700' },
});
