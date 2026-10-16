import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  Platform, Keyboard, Dimensions, LayoutAnimation, UIManager,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { ROLE_LABELS } from '../roleLabels';
import { fetchMessages, sendMessage, markConversationRead, subscribeToMessages, unsubscribe, otherAuthIdFor } from '../chatApi';
import ReportBlockMenu from '../components/ReportBlockMenu';
import { CONTENT_TYPES } from '../moderationApi';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A single open conversation. Kept deliberately simple for a first
// version — no read receipts beyond the list's unread dot, no typing
// indicators, no media. Live delivery comes from a Postgres-changes
// subscription on `messages` (enabled for realtime in the same migration
// that created the table), so a reply from the other person appears
// without needing to leave and reopen the thread.
//
// Keyboard handling is done by hand rather than with
// <KeyboardAvoidingView> — this screen is nested several layers deep
// (App's card panel → HomeTabs' tab content → this screen), and on a real
// device that nesting left KeyboardAvoidingView's automatic "padding"
// behavior computing zero offset, so the input bar rendered underneath
// the keyboard instead of above it. Measuring this screen's own on-screen
// position and the keyboard's own reported height, then padding by
// exactly the overlap between them, sidesteps whatever was confusing the
// built-in component and is what actually moves on a real phone.
// Replying needs Premium (Girik's rule: anyone can receive and read a
// message, but answering requires a subscription). Without it, the message
// box is replaced by a button that opens the Premium screen.
export default function ChatThreadScreen({ session, conversation, otherPerson, onBack, initialDraft, isPremium = true, onRequestUpgrade }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  // Pre-filled and fully editable — used by an Additional Services
  // "Request" tap on a public profile to start the message with a
  // template instead of a blank box. Never auto-sent.
  const [draft, setDraft] = useState(initialDraft || '');
  const [sending, setSending] = useState(false);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const listRef = useRef(null);
  const wrapRef = useRef(null);
  const myAuthId = session?.user?.id;
  const otherAuthId = otherAuthIdFor(conversation, myAuthId);

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
    const rows = await fetchMessages(conversation.id);
    setMessages(rows);
    setLoading(false);
    markConversationRead(conversation, myAuthId);
  }, [conversation, myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = subscribeToMessages(conversation.id, (newMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]));
      if (newMessage.sender_auth_id !== myAuthId) {
        markConversationRead(conversation, myAuthId);
      }
    });
    return () => unsubscribe(channel);
  }, [conversation, myAuthId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    setSending(true);
    try {
      const inserted = await sendMessage(conversation.id, myAuthId, body);
      // The realtime subscription will usually deliver this same row back
      // — the de-dupe check in the subscription handler above means
      // adding it here too just makes MY OWN message feel instant instead
      // of waiting on the round trip.
      if (inserted) {
        setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
      }
    } catch (e) {
      setDraft(body); // put it back so nothing typed is lost
    } finally {
      setSending(false);
    }
  }

  return (
    <View ref={wrapRef} style={[styles.wrap, { paddingBottom: keyboardOverlap }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.brown} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>{otherPerson?.name || 'Member'}</Text>
          {otherPerson?.role && (
            <Text style={styles.headerRole}>{ROLE_LABELS[otherPerson.role] || otherPerson.role}</Text>
          )}
        </View>
        <View style={[styles.backBtn, { alignItems: 'flex-end' }]}>
          <ReportBlockMenu
            myAuthId={myAuthId}
            targetAuthId={otherAuthId}
            targetName={otherPerson?.name}
            contentType={CONTENT_TYPES.profile}
            noun="this person"
            onBlocked={onBack}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 8, gap: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>Say hello — this is the start of your conversation.</Text>}
          renderItem={({ item }) => {
            const mine = item.sender_auth_id === myAuthId;
            return (
              <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.body}</Text>
                </View>
                <View style={styles.timeRow}>
                  <Text style={[styles.timeText, mine ? styles.timeTextMine : styles.timeTextTheirs]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  {!mine && (
                    <ReportBlockMenu
                      myAuthId={myAuthId}
                      targetAuthId={item.sender_auth_id}
                      targetName={otherPerson?.name}
                      contentType={CONTENT_TYPES.directMessage}
                      contentId={item.id}
                      noun="message"
                      size={14}
                      onReported={() => setMessages((prev) => prev.filter((m) => m.id !== item.id))}
                      onBlocked={onBack}
                    />
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {!isPremium ? (
        <View style={styles.lockedBar}>
          <TouchableOpacity style={styles.lockedBtn} onPress={onRequestUpgrade} activeOpacity={0.85}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.white} />
            <Text style={styles.lockedBtnText}>Get Premium to reply</Text>
          </TouchableOpacity>
          <Text style={styles.lockedNote}>Replying to messages is part of Premium.</Text>
        </View>
      ) : (
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message..."
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  lockedBar: {
    borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.1)', paddingTop: 12, paddingBottom: 6, gap: 6, alignItems: 'center',
  },
  lockedBtn: {
    alignSelf: 'stretch', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brown, borderRadius: 999, minHeight: 48, overflow: 'visible',
  },
  lockedBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  lockedNote: { fontSize: 12, color: colors.textSoft },
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
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 13.5, marginTop: 30 },

  bubbleWrap: { maxWidth: '78%', gap: 3 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: colors.brown, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: colors.white, fontSize: 13.5, lineHeight: 19 },
  bubbleTextTheirs: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
