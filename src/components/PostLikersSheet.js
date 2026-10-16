import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, Image, FlatList, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { initialsFor, ROLE_LABELS } from '../roleLabels';
import { fetchPostLikers, fetchSignedUrls } from '../postsApi';

// Instagram-style "Likes" bottom sheet: everyone who liked a post, with
// their photo, name and role. Tapping a person opens their profile.
export default function PostLikersSheet({ postId, visible, onClose, onOpenPerson }) {
  const insets = useSafeAreaInsets();
  const [likers, setLikers] = useState(null);
  const [avatarUrls, setAvatarUrls] = useState({});

  useEffect(() => {
    if (!visible || !postId) return;
    let cancelled = false;
    setLikers(null);
    (async () => {
      const rows = await fetchPostLikers(postId);
      if (cancelled) return;
      setLikers(rows);
      const urls = await fetchSignedUrls('profile-pictures', rows.map((r) => r.profile_picture_path));
      if (!cancelled) setAvatarUrls(urls);
    })();
    return () => { cancelled = true; };
  }, [visible, postId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Likes</Text>
        {likers === null ? (
          <ActivityIndicator color={colors.brown} style={{ marginVertical: 30 }} />
        ) : (
          <FlatList
            data={likers}
            keyExtractor={(item) => item.auth_user_id}
            ListEmptyComponent={<Text style={styles.empty}>No likes yet.</Text>}
            renderItem={({ item }) => {
              const url = item.profile_picture_path ? avatarUrls[item.profile_picture_path] : null;
              return (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => { onClose(); onOpenPerson?.(item); }}
                >
                  {url ? (
                    <Image source={{ uri: url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{initialsFor(item.name)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.name || 'Member'}</Text>
                    <Text style={styles.role}>{ROLE_LABELS[item.role] || item.role}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    maxHeight: '70%', minHeight: 260, paddingHorizontal: 20,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.creamDark, marginTop: 10 },
  title: { textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.text, marginVertical: 12 },
  empty: { textAlign: 'center', color: colors.textSoft, marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.creamDark },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brown, fontWeight: '700' },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  role: { fontSize: 12.5, color: colors.textSoft, marginTop: 1 },
});
