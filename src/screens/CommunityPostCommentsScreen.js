import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  Platform, Keyboard, Dimensions, LayoutAnimation, UIManager,
} from 'react-native';
import { colors, serif } from '../theme';
import { fetchCommunityPostComments, addCommunityPostComment } from '../communitiesApi';
import { fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';
import { initialsFor, ROLE_LABELS } from '../roleLabels';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Identical shape to PostCommentsScreen — just pointed at
// community_post_comments instead of post_comments. Membership isn't
// required to comment on a community post... actually it is (see the
// create_communities_schema migration's RLS policy) — a non-member's
// addComment call will fail and surface through the error box below,
// same as any other Supabase error here.
//
// Keyboard handling is done by hand rather than with <KeyboardAvoidingView>
// — same fix as ChatThreadScreen.js / PostCommentsScreen.js. This screen is
// nested several layers deep (App's card panel → HomeTabs' tab content →
// overlay → this screen), and on a real device that nesting left
// KeyboardAvoidingView's automatic "padding" behavior computing zero
// offset, so the comment box rendered underneath the keyboard instead of
// above it. Measuring this screen's own on-screen position and the
// keyboard's own reported height, then padding by exactly the overlap
// between them, is what actually moves on a real phone.
export default function CommunityPostCommentsScreen({ postId, session, onBack }) {
  const [comments, setComments] = useState(null); // null = loading
  const [authors, setAuthors] = useState({});
  const [avatarUrls, setAvatarUrls] = useState({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
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
    try {
      const data = await fetchCommunityPostComments(postId);
      setComments(data);
      const authorMap = await fetchAuthorsByAuthId(data.map((c) => c.author_auth_id));
      setAuthors(authorMap);
      const avatarPaths = Object.values(authorMap).map((a) => a.profile_picture_path).filter(Boolean);
      const avatars = await fetchSignedUrls('profile-pictures', avatarPaths);
      setAvatarUrls(avatars);
    } catch (e) {
      setError('Couldn’t load comments right now.');
      setComments([]);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await addCommunityPostComment(postId, session?.user?.id, draft.trim());
      setDraft('');
      await load();
    } catch (e) {
      setError('Couldn’t post that comment. You may need to join this community first.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View ref={wrapRef} style={[styles.wrap, { paddingBottom: keyboardOverlap }]}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLinkText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.header}>Comments</Text>

      {comments === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No comments yet — be the first.</Text>}
          renderItem={({ item }) => {
            const author = authors[item.author_auth_id];
            const avatarUrl = author?.profile_picture_path ? avatarUrls[author.profile_picture_path] : null;
            return (
              <View style={styles.commentRow}>
                <View style={styles.commentHeader}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.commentAvatarImg} />
                  ) : (
                    <View style={styles.commentAvatarFallback}>
                      <Text style={styles.commentAvatarFallbackText}>{initialsFor(author?.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.commentAuthor}>
                    {author?.name || 'Someone'}
                    <Text style={styles.commentRole}>  {author ? (ROLE_LABELS[author.role] || author.role) : ''}</Text>
                  </Text>
                </View>
                <Text style={styles.commentBody}>{item.body}</Text>
              </View>
            );
          }}
        />
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textSoft}
          textContentType="none"
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !draft.trim()}>
          <Text style={styles.sendBtnText}>{sending ? '…' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  backLinkText: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  header: { fontFamily: serif, fontSize: 22, color: colors.brown, fontWeight: '700', marginTop: 10, marginBottom: 14 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 30 },
  commentRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.08)' },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAvatarImg: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.creamDark },
  commentAvatarFallback: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 10.5 },
  commentAuthor: { fontSize: 13.5, color: colors.text, fontWeight: '700' },
  commentRole: { fontSize: 11.5, color: colors.textSoft, fontWeight: '400' },
  commentBody: { fontSize: 14, color: colors.text, marginTop: 5, lineHeight: 19, marginLeft: 34 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 10, marginVertical: 8,
  },
  errorText: { color: colors.errorText, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(107,66,38,0.12)' },
  input: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: colors.text,
    minHeight: 38, maxHeight: 110,
  },
  sendBtn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, marginBottom: 1 },
  sendBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
});
