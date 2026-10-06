import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Keyboard, Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import { getMyLeaderRow } from '../postsApi';
import ImagePickerField from '../components/ImagePickerField';

// A Spiritual Leader, Spiritual Mother, or Pastor composing a new Explore
// post — an image with an optional caption, or a text-only "thread". At
// least one of the two is required (matches the posts_has_content check on
// the table).
export default function CreatePostScreen({ session, onBack, onPosted }) {
  const [checking, setChecking] = useState(true);
  const [leaderRow, setLeaderRow] = useState(null);
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null); // { uri, base64, fileName, mimeType }
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMyLeaderRow(session?.user?.id).then((row) => {
      setLeaderRow(row);
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [session]);

  async function handlePost() {
    setError(null);
    if (!body.trim() && !image) {
      setError('Add a photo, some words, or both before posting.');
      return;
    }
    setPosting(true);
    try {
      let imagePath = null;
      if (image) {
        // leaderRow.id is the person's own auth id (see getMyLeaderRow) —
        // the post-images storage policy requires this folder segment to
        // be exactly auth.uid(), not a role-table row id.
        const path = `${leaderRow.id}/${Date.now()}-${image.fileName || 'post.jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(path, decode(image.base64), { contentType: image.mimeType || 'image/jpeg' });
        if (uploadError) throw uploadError;
        imagePath = path;
      }
      const { error: insertError } = await supabase.from('posts').insert({
        author_auth_id: session.user.id,
        body: body.trim() || null,
        image_path: imagePath,
      });
      if (insertError) throw insertError;
      onPosted();
    } catch (e) {
      setError(e.message || 'Something went wrong posting that. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  if (!leaderRow || leaderRow.vetting_status !== 'Approved') {
    // Shouldn't normally be reachable — Explore and the Profile screen only
    // show "+ New Post" to an Approved Spiritual Leader, Mother, or Pastor —
    // but guards against a stale screen if vetting status changes
    // mid-session.
    return (
      <View style={styles.centered}>
        <Text style={styles.notAllowedText}>Only Approved Spiritual Leaders, Mothers, and Pastors can post right now.</Text>
        <TouchableOpacity style={styles.backLink} onPress={onBack}>
          <Text style={styles.backLinkText}>← Back to Explore</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.wrap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>New Post</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Photo (optional)</Text>
        <ImagePickerField value={image} onChange={setImage} />

        <View style={styles.captionLabelRow}>
          <Text style={[styles.label, { flex: 1 }]}>Caption or a few words (optional)</Text>
          <TouchableOpacity onPress={() => Keyboard.dismiss()}>
            <Text style={styles.dismissLink}>Hide keyboard</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.textArea}
          value={body}
          onChangeText={setBody}
          placeholder="Share something with the community…"
          placeholderTextColor={colors.textSoft}
          multiline
          textContentType="none"
        />

        <TouchableOpacity style={[styles.postBtn, posting && styles.postBtnDisabled]} onPress={handlePost} disabled={posting}>
          <Text style={styles.postBtnText}>{posting ? 'Posting…' : 'Post'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  notAllowedText: { fontSize: 14.5, color: colors.textSoft, textAlign: 'center', marginBottom: 16 },
  backLinkText: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  backLink: {},
  header: { fontFamily: serif, fontSize: 24, color: colors.brown, fontWeight: '700', marginTop: 10, marginBottom: 16 },
  label: { fontSize: 13.5, color: colors.text, fontWeight: '700', marginBottom: 8 },
  captionLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18,
  },
  dismissLink: { fontSize: 12.5, color: colors.brown, fontWeight: '600', marginBottom: 8, marginLeft: 10 },
  textArea: {
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 10, padding: 12,
    minHeight: 100, fontSize: 15, color: colors.text, textAlignVertical: 'top',
  },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  postBtn: {
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 40,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
