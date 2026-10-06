import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { colors } from '../theme';

// Certification/license document upload for the vetted professional roles
// (Spiritual Mother, Priest/Pastor, Spiritual Leader) — only ever rendered
// once someone has said "Yes, I do" to the higher-education gate field (see
// flows.js). Stores { uri, base64, fileName, mimeType } in the parent's
// form state, the same shape ImagePickerField uses for the profile picture
// — App.js pulls it out into its own `certificationFile` payload key at
// submit time rather than sending it through the normal field map.
export default function CertificationUploadField({ value, onChange }) {
  const [busy, setBusy] = useState(false);

  async function pick() {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || !result.assets[0]) return;

      const asset = result.assets[0];
      // expo-file-system's current (SDK 57+) API reads a file's contents
      // through the File class rather than the old readAsStringAsync
      // helper — DocumentPicker itself doesn't return base64 on native.
      const base64 = await new File(asset.uri).base64();
      onChange({
        uri: asset.uri,
        base64,
        fileName: asset.name || 'certification.pdf',
        mimeType: asset.mimeType || 'application/octet-stream',
      });
    } catch (e) {
      Alert.alert('Something went wrong', 'Could not open your files. You can skip this and add it later from your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <TouchableOpacity style={styles.box} onPress={pick} disabled={busy}>
        <Text style={styles.boxLabel} numberOfLines={2}>
          {busy ? 'Opening…' : value ? (value.fileName || 'Certification selected ✓') : 'Choose file to upload'}
        </Text>
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
  box: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brownPale,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  boxLabel: { fontSize: 13.5, fontWeight: '700', color: colors.text, textAlign: 'center' },
  remove: { color: colors.textSoft, fontSize: 13, textAlign: 'center', marginBottom: 4 },
});
