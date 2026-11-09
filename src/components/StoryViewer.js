import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, Modal, TouchableOpacity, StyleSheet, Animated, Easing, Alert, StatusBar,
  PanResponder, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { deleteStory } from '../postsApi';
import { CONTENT_TYPES } from '../moderationApi';
import { ReportBlockSheet } from './ReportBlockMenu';
import { markStorySeen } from './StoriesRow';

const STORY_MS = 5000;

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

// Full-screen story player. Tap the right side for the next story, the left
// side for the previous one. Each photo plays for 5 seconds.
export default function StoryViewer({
  visible, groups, startIndex, imageUrls, myAuthId, onClose, onDeleted, onHideAuthor, onBlocked,
}) {
  const insets = useSafeAreaInsets();
  const [gi, setGi] = useState(startIndex || 0);
  const [si, setSi] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'ok' | 'error'
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current; // how far the story has been pulled down
  const { width: winW, height: winH } = useWindowDimensions();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) { setGi(startIndex || 0); setSi(0); drag.setValue(0); }
  }, [visible, startIndex, drag]);

  // Swipe down to dismiss, like Instagram: the story shrinks and fades as you
  // pull, and slides away if you pull far enough (or flick).
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (e, g) => {
        setDragging(false);
        if (g.dy > 110 || g.vy > 0.9) {
          Animated.timing(drag, { toValue: 700, duration: 180, useNativeDriver: true }).start(() => onCloseRef.current());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const group = groups[gi];
  const story = group ? group.stories[Math.min(si, group.stories.length - 1)] : null;

  const next = useCallback(() => {
    if (!group) return;
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  }, [group, si, gi, groups.length, onClose]);

  const prev = useCallback(() => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(0); }
    else { progress.setValue(0); }
  }, [si, gi, progress]);

  // Auto-advance, paused while the report sheet is open or while pulling down.
  useEffect(() => {
    if (!visible || !story || reporting || dragging) return undefined;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: STORY_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => { if (finished) next(); });
    return () => anim.stop();
  }, [visible, story && story.id, reporting, dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each new photo starts in the loading state.
  useEffect(() => { setImgState('loading'); }, [visible, story && story.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (visible && story) markStorySeen(story.id); }, [visible, story && story.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !group || !story) return null;

  const isMine = group.authorId === myAuthId;
  const imageUrl = imageUrls[story.image_path];

  function confirmDelete() {
    Alert.alert('Delete this story?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteStory(story);
            onDeleted(story.id);
          } catch (e) {
            Alert.alert('Couldn’t delete', 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[styles.backdrop, { opacity: drag.interpolate({ inputRange: [0, 400], outputRange: [1, 0], extrapolate: 'clamp' }) }]}
        pointerEvents="none"
      />
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.root,
          {
            transform: [
              { translateY: drag },
              { scale: drag.interpolate({ inputRange: [0, 400], outputRange: [1, 0.78], extrapolate: 'clamp' }) },
            ],
            borderRadius: dragging ? 24 : 0,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            key={imageUrl}
            source={{ uri: imageUrl }}
            style={{ width: winW, height: winH }}
            resizeMode="cover"
            fadeDuration={0}
            onLoad={() => setImgState('ok')}
            onError={() => setImgState('error')}
          />
        ) : (
          <View style={[styles.center, { width: winW, height: winH }]}><Text style={styles.noImageText}>Loading…</Text></View>
        )}
        {imageUrl && imgState === 'loading' ? (
          <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none"><ActivityIndicator color="#fff" /></View>
        ) : null}
        {imgState === 'error' ? (
          <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
            <Text style={styles.noImageText}>Couldn’t load this photo.</Text>
          </View>
        ) : null}
        <View style={styles.shade} pointerEvents="none" />

        {/* Tap zones */}
        <View style={styles.tapRow}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={prev} accessibilityLabel="Previous story" />
          <TouchableOpacity style={{ flex: 2 }} activeOpacity={1} onPress={next} accessibilityLabel="Next story" />
        </View>

        {/* Progress bars */}
        <View style={[styles.bars, { top: insets.top + 8 }]}>
          {group.stories.map((s, i) => (
            <View key={s.id} style={styles.barTrack}>
              {i < si ? <View style={[styles.barFill, { width: '100%' }]} /> : null}
              {i === si ? (
                <Animated.View style={[styles.barFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={[styles.header, { top: insets.top + 20 }]} pointerEvents="box-none">
          {group.avatarUrl ? (
            <Image source={{ uri: group.avatarUrl }} style={styles.hAvatar} />
          ) : (
            <View style={[styles.hAvatar, styles.hAvatarFallback]}>
              <Text style={styles.hInitial}>{(group.name || '?')[0].toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.hName} numberOfLines={1}>{isMine ? 'Your story' : group.name}</Text>
          <Text style={styles.hTime}>{timeAgo(story.created_at)}</Text>
          <View style={{ flex: 1 }} />
          {isMine ? (
            <TouchableOpacity onPress={confirmDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.hBtn} accessibilityLabel="Delete story">
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setReporting(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.hBtn} accessibilityLabel="Report or block">
              <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.hBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {story.caption ? (
          <View style={[styles.captionBox, { bottom: insets.bottom + 28 }]} pointerEvents="none">
            <Text style={styles.caption}>{story.caption}</Text>
          </View>
        ) : null}

        <ReportBlockSheet
          visible={reporting}
          onClose={() => setReporting(false)}
          myAuthId={myAuthId}
          targetAuthId={group.authorId}
          targetName={group.name}
          contentType={CONTENT_TYPES.profile}
          noun="story"
          onReported={() => { setReporting(false); onHideAuthor(group.authorId); }}
          onBlocked={() => { setReporting(false); onBlocked(); }}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  noImageText: { color: '#fff', opacity: 0.7 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  tapRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  bars: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: '#fff' },
  header: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hAvatar: { width: 34, height: 34, borderRadius: 17 },
  hAvatarFallback: { backgroundColor: colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  hInitial: { color: colors.brown, fontWeight: '700' },
  hName: { color: '#fff', fontWeight: '700', fontSize: 14.5, maxWidth: 170 },
  hTime: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  hBtn: { padding: 6 },
  captionBox: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  caption: {
    color: '#fff', fontSize: 16, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, overflow: 'hidden',
  },
});
