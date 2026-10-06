import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import { supabase } from '../supabaseClient';
import { fetchSignedUrls } from '../postsApi';
import { removeRealFamilyMember } from '../realFamilyApi';

// A simple, read-mostly page for one real family member — deliberately
// NOT a copy of FamilySiblingPageScreen's mentorship apparatus (Present
// Challenges, Mother's Response, Do's/Don'ts guidance, Book a Call): none
// of that fits a biological family relationship the way it fits a
// Spiritual Mother/Pastor's mentoring relationship with a Seeker. This
// just shows who they are and, if you're the family's owner, lets you
// remove them.
export default function RealFamilyMemberPageScreen({ membership, targetAuthId, targetName, isOwner, onBack, onRemoved }) {
  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('directory_listing')
      .select('*')
      .eq('auth_user_id', targetAuthId)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = data && data.length ? data[0] : null;
    setPerson(row);
    if (row?.profile_picture_path) {
      const urls = await fetchSignedUrls('profile-pictures', [row.profile_picture_path]);
      setAvatarUrl(urls[row.profile_picture_path] || null);
    }
    setLoading(false);
  }, [targetAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  function confirmRemove() {
    Alert.alert(
      'Remove from family?',
      `${targetName || 'This person'} will no longer be part of this family.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeRealFamilyMember(membership.id);
              onRemoved?.();
            } catch (e) {
              setRemoving(false);
              Alert.alert('Couldn’t remove them right now', 'Please try again in a moment.');
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.brown} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{targetName || 'Family Member'}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initialsFor(person?.name || targetName)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{person?.name || targetName || 'Family Member'}</Text>
          {membership?.relationship ? (
            <View style={styles.relBadge}>
              <Text style={styles.relBadgeText}>{membership.relationship.toUpperCase()}</Text>
            </View>
          ) : null}

          {person?.story ? (
            <View style={styles.bioCard}>
              <Text style={styles.bioLabel}>About</Text>
              <Text style={styles.bioText}>{person.story}</Text>
            </View>
          ) : null}

          {isOwner && (
            <TouchableOpacity style={styles.removeBtn} onPress={confirmRemove} disabled={removing} activeOpacity={0.8}>
              {removing ? (
                <ActivityIndicator color={colors.errorText} />
              ) : (
                <Text style={styles.removeBtnText}>Remove from Family</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 14, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  backBtn: { width: 32 },
  topBarTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 17, color: colors.brown, fontWeight: '700' },

  body: { alignItems: 'center', paddingTop: 20 },
  avatarWrap: { marginBottom: 14 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.creamDark },
  avatarFallback: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarFallbackText: { color: colors.brown, fontWeight: '700', fontSize: 30 },
  name: { fontFamily: serif, fontSize: 21, color: colors.brown, fontWeight: '700' },
  relBadge: { backgroundColor: colors.creamDark, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, marginTop: 8, overflow: 'visible' },
  relBadgeText: { fontSize: 11, color: colors.brown, fontWeight: '700', letterSpacing: 0.6 },

  bioCard: {
    alignSelf: 'stretch', backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 12, padding: 14, marginTop: 24,
  },
  bioLabel: { fontSize: 12, color: colors.brown, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  bioText: { fontSize: 14.5, color: colors.text, lineHeight: 21 },

  removeBtn: {
    marginTop: 30, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: 999,
    paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', overflow: 'visible',
  },
  removeBtnText: { color: colors.errorText, fontSize: 13.5, fontWeight: '700' },
});
