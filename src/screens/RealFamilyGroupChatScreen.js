import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  Platform, Keyboard, Dimensions, LayoutAnimation, UIManager,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import {
  fetchRealFamilyMembers, fetchRealFamilyGroupMessages, sendRealFamilyGroupMessage, subscribeToRealFamilyGroupMessages,
} from '../realFamilyApi';
import { fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';
import { unsubscribe } from '../chatApi';
import ReportBlockMenu from '../components/ReportBlockMenu';
import { CONTENT_TYPES, fetchBlockedIdSet } from '../moderationApi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// The one group chat per real family — the owner plus every currently-
// accepted member, all in a single thread. A near-exact copy of
// FamilyGroupChatScreen.js (same table shape, same by-hand keyboard
// handling for the same nesting-depth reason — App's card panel ->
// HomeTabs' tab content -> FamilyScreen -> RealFamilyScreen -> this
// screen), pointed at the real_family_* tables instead.
export default function RealFamilyGroupChatScreen({ session, family, isOwner, ownerName, onBack }) {
  const myAuthId = session?.user?.id;
  const [messages, setMessages] = useState([]);
  const [blocked, setBlocked] = useState(() => new Set()); // auth ids whose messages are hidden
  const [people, setPeople] = useState({}); // auth_id -> {name, role, profile_picture_path}
  const [avatarUrls, setAvatarUrls] = useState({}); // profile_picture_path -> signed url
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const listRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      const keyboardHeight = e?.endCoordinates?.height || 0;
      wrapRef.current?.measureInWindow((x, y, width, height) => {
        const screenHeight = Dimensions.get('window').height;
        const wrapBottom = y + height;
        const keyboardTop = screenHeight - keyboardHeight;
        const overlap = Math.max(0, wrapBottom - keyboardTop);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardOverlap(overlap);
      });
    };
    const onHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOverlap(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [msgs, memberRows] = await Promise.all([
      fetchRealFamilyGroupMessages(family.id),
      fetchRealFamilyMembers(family.id),
    ]);
    setMessages(msgs);
    setBlocked(await fetchBlockedIdSet(true));
    const ids = [family.owner_auth_id, ...memberRows.map((m) => m.member_auth_id)];
    const peopleMap = await fetchAuthorsByAuthId(ids);
    setPeople(peopleMap);
    const paths = Object.values(peopleMap).map((p) => p.profile_picture_path).filter(Boolean);
    setAvatarUrls(await fetchSignedUrls('profile-pictures', paths));
    setLoading(false);
  }, [family.id, family.owner_auth_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = subscribeToRealFamilyGroupMessages(family.id, (newMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]));
    });
    return () => unsubscribe(channel);
  }, [family.id]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    setSending(true);
    try {
      const inserted = await sendRealFamilyGroupMessage(family.id, myAuthId, body);
      if (inserted) {
        setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
      }
    } catch (e) {
      setDraft(body); // put it back so nothing typed is lost
    } finally {
      setSending(false);
    }
  }

  const memberCount = Object.keys(people).length;
  const familyTitle = family.family_name || (isOwner ? 'Your Family' : `${ownerName || 'Their'} Family`);

  return (
    <View ref={wrapRef} style={[styles.wrap, { paddingBottom: keyboardOverlap }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.brown} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{familyTitle}</Text>
          <Text style={styles.headerRole}>{memberCount ? `${memberCount} members` : 'Group chat'}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages.filter((m) => !blocked.has(m.sender_auth_id))}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 8, gap: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Say hello — this is the start of your family's conversation together.
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_auth_id === myAuthId;
            const sender = people[item.sender_auth_id];
            const isOwnerMsg = item.sender_auth_id === family.owner_auth_id;
            const avatarUrl = sender?.profile_picture_path ? avatarUrls[sender.profile_picture_path] : null;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                {!mine && (
                  <View style={styles.senderRow}>
                    <View style={styles.senderAvatar}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.senderAvatarImg} />
                      ) : (
                        <Text style={styles.senderAvatarText}>{initialsFor(sender?.name)}</Text>
                      )}
                    </View>
                    <Text style={styles.senderName} numberOfLines={1}>
                      {sender?.name || 'Family Member'}{isOwnerMsg ? ' · Organizer' : ''}
                    </Text>
                    <ReportBlockMenu
                      myAuthId={myAuthId}
                      targetAuthId={item.sender_auth_id}
                      targetName={sender?.name}
                      contentType={CONTENT_TYPES.groupMessage}
                      contentId={item.id}
                      noun="message"
                      size={14}
                      onReported={() => setMessages((prev) => prev.filter((m) => m.id !== item.id))}
                      onBlocked={async () => setBlocked(await fetchBlockedIdSet(true))}
                    />
                  </View>
                )}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.body}</Text>
                </View>
                <Text style={[styles.timeText, mine ? styles.timeTextMine : styles.timeTextTheirs]}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message your family..."
          placeholderTextColor={colors.textSoft}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={17} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 14, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerRole: { fontSize: 11.5, color: colors.textSoft, marginTop: 1 },
  list: { flex: 1 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 13.5, marginTop: 30, paddingHorizontal: 20 },

  bubbleWrap: { maxWidth: '78%', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  senderAvatar: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  senderAvatarImg: { width: 18, height: 18, borderRadius: 9 },
  senderAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 8.5, color: colors.brown },
  senderName: { fontSize: 11, fontWeight: '700', color: colors.brownLight },

  bubble: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: colors.brown, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: colors.white, fontSize: 13.5, lineHeight: 19 },
  bubbleTextTheirs: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  timeText: { fontSize: 10.5, color: colors.textSoft },
  timeTextMine: { marginRight: 4 },
  timeTextTheirs: { marginLeft: 4 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 4, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)',
  },
  input: {
    flex: 1, backgroundColor: colors.cream, borderWidth: 1, borderColor: 'rgba(107,66,38,0.15)',
    borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, fontSize: 13.5, color: colors.text, maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
});
