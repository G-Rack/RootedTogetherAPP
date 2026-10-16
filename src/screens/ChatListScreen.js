import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import { fetchAuthorsByAuthId } from '../postsApi';
import { fetchConversations, otherAuthIdFor, isUnread } from '../chatApi';
import PremiumUpsellScreen from './PremiumUpsellScreen';

// Relative time to match the "2m / 1h / Yesterday" style in the reference
// — nothing fancier than that is needed for a first version.
function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

// The Chat tab's default view. A free member with zero conversations sees
// the Premium upsell (there's nothing else to show them); anyone with at
// least one conversation sees the real list, Premium or not, so they can
// see who messaged them and read it. Replying needs Premium (ChatThreadScreen
// shows a "Get Premium to reply" button instead of the message box), and so
// does starting a new conversation (HomeTabs' handleSendMessage).
export default function ChatListScreen({ session, isPremium, onOpenThread, onUpgrade, onFindPeople }) {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [people, setPeople] = useState({});

  const myAuthId = session?.user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const convos = await fetchConversations(myAuthId);
    setConversations(convos);
    const otherIds = convos.map((c) => otherAuthIdFor(c, myAuthId));
    setPeople(await fetchAuthorsByAuthId(otherIds));
    setLoading(false);
  }, [myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  if (!conversations.length && !isPremium) {
    return <PremiumUpsellScreen context="chat" onUpgrade={onUpgrade} />;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <View style={styles.topBarTitleRow}>
          <Text style={styles.topBarTitle}>Chat</Text>
          {isPremium && (
            <View style={styles.premiumTag}>
              <Text style={styles.premiumTagText}>PREMIUM</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No conversations yet — visit Directory or Explore and tap “Send a message” on someone to start one.
          </Text>
        }
        renderItem={({ item }) => {
          const otherId = otherAuthIdFor(item, myAuthId);
          const person = people[otherId];
          const unread = isUnread(item, myAuthId);
          const iSentLast = item.last_sender_auth_id === myAuthId;
          return (
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onOpenThread(item, person)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsFor(person?.name)}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTopLine}>
                  <Text style={styles.rowName} numberOfLines={1}>{person?.name || 'Member'}</Text>
                  <Text style={styles.rowTime}>{item.last_message_at ? timeAgo(item.last_message_at) : ''}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {item.last_message_preview ? `${iSentLast ? 'You: ' : ''}${item.last_message_preview}` : 'Say hello…'}
                </Text>
              </View>
              {unread && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={onFindPeople} activeOpacity={0.8}>
        <Ionicons name="add" size={22} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  topBar: { paddingBottom: 14, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)' },
  topBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarTitle: { fontFamily: serif, fontSize: 21, color: colors.brown, fontWeight: '700' },
  premiumTag: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, overflow: 'visible' },
  premiumTagText: { color: colors.white, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.4 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 30, marginHorizontal: 20, lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white,
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14, padding: 13, marginTop: 8,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 999, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontFamily: serif, fontWeight: '700', fontSize: 15, color: colors.brown },
  rowBody: { flex: 1, minWidth: 0 },
  rowTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowName: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  rowTime: { fontSize: 11, color: colors.textSoft, marginLeft: 8 },
  rowPreview: { fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  unreadDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.brown, flexShrink: 0 },
  fab: {
    position: 'absolute', right: 4, bottom: 12, width: 52, height: 52, borderRadius: 999,
    backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
});
