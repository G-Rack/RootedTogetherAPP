import React, { useState } from 'react';
import {
  View, Text, TextInput, Image, TouchableOpacity, StyleSheet, Keyboard,
} from 'react-native';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { colors, serif } from '../theme';
import { createStory } from '../postsApi';

// Preview a photo, add an optional line of text, and share it to your story.
export default function CreateStoryScreen({ session, image, onBack, onPosted }) {
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  async function handleShare() {
    setError(null);
    setPosting(true);
    try {
      await createStory(session.user.id, image, caption);
      onPosted();
    } catch (e) {
      setError(e.message || 'Couldn’t share your story. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <KeyboardAwareScrollView style={styles.wrap}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Your story</Text>

        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        ) : null}

        <View style={styles.previewWrap}>
          <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
        </View>

        <View style={styles.captionRow}>
          <Text style={[styles.label, { flex: 1 }]}>Add a few words (optional)</Text>
          <TouchableOpacity onPress={() => Keyboard.dismiss()}>
            <Text style={styles.dismissLink}>Hide keyboard</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={caption}
          onChangeText={setCaption}
          placeholder="Say something about this…"
          placeholderTextColor={colors.textSoft}
          maxLength={200}
          multiline
        />
        <Text style={styles.note}>Stories disappear after 24 hours.</Text>

        <TouchableOpacity style={[styles.btn, posting && { opacity: 0.6 }]} onPress={handleShare} disabled={posting}>
          <Text style={styles.btnText}>{posting ? 'Sharing…' : 'Share to your story'}</Text>
        </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  backLinkText: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  header: { fontFamily: serif, fontSize: 24, color: colors.brown, fontWeight: '700', marginTop: 10, marginBottom: 16 },
  previewWrap: { alignItems: 'center', marginBottom: 6 },
  preview: { width: '46%', aspectRatio: 9 / 16, borderRadius: 16, backgroundColor: colors.creamDark },
  captionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  label: { fontSize: 13.5, color: colors.text, fontWeight: '700', marginBottom: 8 },
  dismissLink: { fontSize: 12.5, color: colors.brown, fontWeight: '600', marginBottom: 8, marginLeft: 10 },
  input: {
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 10, padding: 12, minHeight: 64,
    fontSize: 15, color: colors.text, textAlignVertical: 'top',
  },
  note: { fontSize: 12.5, color: colors.textSoft, marginTop: 8 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  btn: { backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  btnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
