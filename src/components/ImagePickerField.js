import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme';

// Optional profile picture. Stores { uri, base64, fileName, mimeType } in
// the parent's form state — the base64 is what actually travels to the
// backend (see App.js submit()), the uri is only for the local preview.
export default function ImagePickerField({ value, onChange }) {
  const [busy, setBusy] = useState(false);

  async function pick() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo access needed', 'Enable photo library access in Settings to add a profile picture.');
        return;
      }
      setBusy(true);
      // Expo's image-picker API for "just photos" changed from an enum to a
      // plain string array across SDK versions — feature-detect so this
      // keeps working either way instead of hardcoding one shape.
      const mediaTypes = ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'];
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        onChange({
          uri: asset.uri,
          base64: asset.base64,
          fileName: asset.fileName || 'profile.jpg',
          mimeType: asset.mimeType || 'image/jpeg',
        });
      }
    } catch (e) {
      Alert.alert('Something went wrong', 'Could not open your photo library. You can skip this and add it later.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.circle} onPress={pick} disabled={busy}>
        {value && value.uri ? (
          <Image source={{ uri: value.uri }} style={styles.image} />
        ) : (
          <Text style={styles.plus}>+</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={pick} disabled={busy}>
        <Text style={styles.link}>{busy ? 'Opening…' : value ? 'Change photo' : 'Choose a photo'}</Text>
      </TouchableOpacity>
      {value ? (
        <TouchableOpacity onPress={() => onChange(null)}>
          <Text style={styles.remove}>Remove</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.creamDark,
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  image: { width: 56, height: 56, borderRadius: 28 },
  plus: { fontSize: 22, color: colors.brownLight },
  link: { color: colors.brown, fontSize: 14, fontWeight: '600' },
  remove: { color: colors.textSoft, fontSize: 13 },
});
