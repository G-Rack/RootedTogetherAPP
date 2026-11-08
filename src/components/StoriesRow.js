import React from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';

// Which stories this person has already watched, for the lifetime of the app
// session. A watched circle gets a pale ring; a new one gets a brown ring.
const seenStoryIds = new Set();
export function markStorySeen(id) { seenStoryIds.add(id); }
export function groupFullySeen(group) { return group.stories.every((s) => seenStoryIds.has(s.id)); }

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function Bubble({ label, avatarUrl, name, ring, onPress, plus }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.ring, ring === 'new' && styles.ringNew, ring === 'seen' && styles.ringSeen]}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials(name)}</Text>
            </View>
          )}
        </View>
        {plus ? (
          <View style={styles.plusBadge}>
            <Ionicons name="add" size={14} color={colors.white} />
          </View>
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

// groups: [{ authorId, name, avatarUrl, stories: [...], isMe }]
// me: { name, avatarUrl } so "Your story" has a face even before posting one.
export default function StoriesRow({ groups, me, canPost, onAdd, onOpenGroup }) {
  const myGroupIndex = groups.findIndex((g) => g.isMe);
  const myGroup = myGroupIndex >= 0 ? groups[myGroupIndex] : null;
  const others = groups.map((g, index) => ({ g, index })).filter((x) => !x.g.isMe);

  if (!canPost && others.length === 0 && !myGroup) return null;

  const header = canPost || myGroup ? (
    <Bubble
      label="Your story"
      name={me?.name}
      avatarUrl={me?.avatarUrl}
      ring={myGroup ? (groupFullySeen(myGroup) ? 'seen' : 'new') : null}
      plus={canPost}
      onPress={() => (myGroup ? onOpenGroup(myGroupIndex) : onAdd())}
    />
  ) : null;

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={others}
        keyExtractor={(x) => x.g.authorId}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <Bubble
            label={item.g.name || 'Someone'}
            name={item.g.name}
            avatarUrl={item.g.avatarUrl}
            ring={groupFullySeen(item.g) ? 'seen' : 'new'}
            onPress={() => onOpenGroup(item.index)}
          />
        )}
      />
    </View>
  );
}

const SIZE = 64;
const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  content: { paddingHorizontal: 24, paddingVertical: 4, gap: 14 },
  item: { alignItems: 'center', width: SIZE + 14 },
  ring: {
    width: SIZE + 8, height: SIZE + 8, borderRadius: (SIZE + 8) / 2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  ringNew: { borderColor: colors.brown },
  ringSeen: { borderColor: colors.brownPale },
  avatarWrap: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden' },
  avatar: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  avatarFallback: { backgroundColor: colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: colors.brown, fontSize: 20, fontWeight: '700' },
  plusBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brown,
    borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center',
  },
  label: { marginTop: 4, fontSize: 12, color: colors.text, maxWidth: SIZE + 12 },
});
