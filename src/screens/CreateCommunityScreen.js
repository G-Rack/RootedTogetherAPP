import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import { colors, serif } from '../theme';
import { supabase } from '../supabaseClient';
import { createCommunity } from '../communitiesApi';
import ImagePickerField from '../components/ImagePickerField';

export default function CreateCommunityScreen({ session, onBack, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null); // { uri, base64, fileName, mimeType }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const myAuthId = session?.user?.id;
  const canSave = name.trim().length >= 3 && !saving;

  async function handleCreate() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      let imagePath = null;
      if (image) {
        const path = `${myAuthId}/${Date.now()}-${image.fileName || 'community.jpg'}`;
        const { error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(path, decode(image.base64), { contentType: image.mimeType || 'image/jpeg' });
        if (uploadError) throw uploadError;
        imagePath = path;
      }
      const id = await createCommunity({
        name: name.trim(),
        description: description.trim() || null,
        imagePath,
      }, myAuthId);
      onCreated(id);
    } catch (e) {
      setError(e.message || 'Couldn’t create that community. Please try again.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.wrap} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLinkText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Create a Community</Text>
        <Text style={styles.subheader}>
          Start a place for people to discuss, encourage, and grow together around a specific topic.
        </Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Community image (optional)</Text>
        <ImagePickerField value={image} onChange={setImage} />

        <Text style={[styles.label, { marginTop: 18 }]}>Community name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Grief & Loss Support"
          placeholderTextColor={colors.textSoft}
          maxLength={60}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this community for? Who is it for?"
          placeholderTextColor={colors.textSoft}
          multiline
          textAlignVertical="top"
          maxLength={400}
        />

        <TouchableOpacity
          style={[styles.createBtn, !canSave && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canSave}
        >
          <Text style={styles.createBtnText}>{saving ? 'Creating…' : 'Create Community'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  backLinkText: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  header: { fontFamily: serif, fontSize: 24, color: colors.brown, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  subheader: { fontSize: 13.5, color: colors.textSoft, lineHeight: 19, marginBottom: 20 },
  label: { fontSize: 13.5, color: colors.text, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
  input: {
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, marginBottom: 18,
  },
  textArea: {
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', borderRadius: 10, padding: 12,
    minHeight: 80, fontSize: 14.5, color: colors.text, marginBottom: 18,
  },
  createBtn: {
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 14,
    alignItems: 'center', marginTop: 10, marginBottom: 40,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '700' },
});
