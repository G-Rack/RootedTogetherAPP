import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { colors, serif } from '../theme';
import { createCommunityPost } from '../communitiesApi';

const TAGS = [
  { key: 'motivational', label: 'Motivational' },
  { key: 'support', label: 'Seeking Support' },
];

// Reachable only from a community's "+ New Post" button, which is itself
// only shown to a current member — see CommunityDetailScreen. Defaults to
// whichever tab the person was looking at when they tapped New Post.
export default function CreateCommunityPostScreen({ communityId, initialTag, session, onBack, onPosted }) {
  const [tag, setTag] = useState(initialTag === 'support' ? 'support' : 'motivational');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const myAuthId = session?.user?.id;

  async function handlePost() {
    if (!body.trim()) {
      setError('Write something before posting.');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await createCommunityPost(communityId, myAuthId, tag, body.trim());
      onPosted();
    } catch (e) {
      setError(e.message || 'Couldn’t post that. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.wrap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
            <TouchableOpacity onPress={onBack}>
              <Text style={styles.backLinkText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.header}>New Post</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>This post is…</Text>
            <View style={styles.tagRow}>
              {TAGS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tagPill, tag === t.key && styles.tagPillSelected]}
                  onPress={() => setTag(t.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tagPillText, tag === t.key && styles.tagPillTextSelected]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.textArea}
              value={body}
              onChangeText={setBody}
              placeholder={tag === 'support'
                ? 'Share what you’re going through — this community is here for you…'
                : 'Share something encouraging with the community…'}
              placeholderTextColor={colors.textSoft}
              multiline
              textAlignVertical="top"
              textContentType="none"
            />

            <TouchableOpacity style={[styles.postBtn, posting && styles.postBtnDisabled]} onPress={handlePost} disabled={posting}>
              <Text style={styles.postBtnText}>{posting ? 'Posting…' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  backLinkText: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  header: { fontFamily: serif, fontSize: 24, color: colors.brown, fontWeight: '700', marginTop: 10, marginBottom: 16 },
  label: { fontSize: 13.5, color: colors.text, fontWeight: '700', marginBottom: 8 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  tagPill: {
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5,
    borderColor: colors.brownPale, backgroundColor: colors.white, overflow: 'visible',
  },
  tagPillSelected: { backgroundColor: colors.brown, borderColor: colors.brown },
  tagPillText: { fontSize: 13, fontWeight: '600', color: colors.text },
  tagPillTextSelected: { color: colors.white },
  textArea: {
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 10, padding: 12,
    minHeight: 140, fontSize: 15, color: colors.text,
  },
  postBtn: {
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 14,
    alignItems: 'center', marginTop: 24, marginBottom: 40,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
