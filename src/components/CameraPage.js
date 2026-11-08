import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';

// The page you reach by swiping Explore sideways. Choose Story or Post, then
// take a photo with the phone's camera or pick one from the gallery. Post also
// offers a words-only post.
export default function CameraPage({ onPicked, onTextPost }) {
  const [mode, setMode] = useState('story'); // 'story' | 'post'
  const [busy, setBusy] = useState(false);

  async function pick(source) {
    if (busy) return;
    try {
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          source === 'camera' ? 'Camera access needed' : 'Photo access needed',
          source === 'camera'
            ? 'Turn on camera access for Rooted Together in your phone’s Settings to take a photo.'
            : 'Turn on photo access for Rooted Together in your phone’s Settings to choose a photo.'
        );
        return;
      }
      setBusy(true);
      // Expo changed this option from an enum to a string array between
      // versions, so feature-detect it (same approach as ImagePickerField).
      const mediaTypes = ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'];
      const options = {
        mediaTypes,
        allowsEditing: mode === 'post',
        aspect: [4, 5],
        quality: 0.6,
        base64: true,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (!asset.base64) {
          Alert.alert('Couldn’t read that photo', 'Please try another one.');
          return;
        }
        onPicked(mode, {
          uri: asset.uri,
          base64: asset.base64,
          fileName: asset.fileName || 'photo.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      Alert.alert('Something went wrong', 'Couldn’t open that. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.seg}>
        {['story', 'post'].map((m) => (
          <TouchableOpacity key={m} style={[styles.segBtn, mode === m && styles.segBtnOn]} onPress={() => setMode(m)} activeOpacity={0.8}>
            <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'story' ? 'Story' : 'Post'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.title}>{mode === 'story' ? 'Add to your story' : 'Share a new post'}</Text>
      <Text style={styles.sub}>
        {mode === 'story' ? 'A photo that disappears after 24 hours.' : 'A photo with a caption, or just your words.'}
      </Text>

      <TouchableOpacity style={styles.shutterOuter} onPress={() => pick('camera')} activeOpacity={0.8} accessibilityLabel="Take a photo">
        {busy ? <ActivityIndicator color={colors.brown} /> : <View style={styles.shutterInner}><Ionicons name="camera" size={30} color={colors.brown} /></View>}
      </TouchableOpacity>
      <Text style={styles.shutterLabel}>Take a photo</Text>

      <TouchableOpacity style={styles.galleryBtn} onPress={() => pick('library')} activeOpacity={0.8}>
        <Ionicons name="images-outline" size={18} color="#fff" />
        <Text style={styles.galleryText}>Choose from gallery</Text>
      </TouchableOpacity>

      {mode === 'post' ? (
        <TouchableOpacity onPress={onTextPost} style={styles.textLink} activeOpacity={0.7}>
          <Text style={styles.textLinkText}>Write a words-only post</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.hint}>
        <Text style={styles.hintText}>Swipe left to go back to Explore</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#2E1B10', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  seg: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: 4, marginBottom: 26,
  },
  segBtn: { paddingVertical: 8, paddingHorizontal: 26, borderRadius: 999 },
  segBtnOn: { backgroundColor: '#FBF6EF' },
  segText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14.5 },
  segTextOn: { color: colors.brown },
  title: { fontFamily: serif, fontSize: 24, color: '#FBF6EF', fontWeight: '700', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 6, textAlign: 'center' },
  shutterOuter: {
    marginTop: 34, width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: '#FBF6EF',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FBF6EF', alignItems: 'center', justifyContent: 'center' },
  shutterLabel: { color: '#FBF6EF', marginTop: 10, fontSize: 14, fontWeight: '600' },
  galleryBtn: {
    marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', paddingVertical: 12, paddingHorizontal: 22,
  },
  galleryText: { color: '#fff', fontWeight: '600', fontSize: 14.5 },
  textLink: { marginTop: 18, padding: 6 },
  textLinkText: { color: '#E3C99A', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
  hint: { position: 'absolute', bottom: 22, flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintText: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5 },
});
