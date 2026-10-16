import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, PanResponder, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import { fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';
import {
  MAX_SIBLINGS, fetchFamilyMembers, fetchPendingRequests, respondToRequest, updateSiblingPosition,
} from '../familyApi';

// A straight connector line between two points, drawn with a plain View
// rather than react-native-svg (not a dependency of this project) —
// position it at the start point, size it to the distance between the
// two points, then rotate around its own left edge.
function LineBetween({ x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x1,
        top: y1,
        width: length,
        height: 2,
        backgroundColor: colors.brownPale,
        transform: [{ rotate: `${angleDeg}deg` }],
        transformOrigin: '0 50%',
      }}
    />
  );
}

// One sibling's avatar on the map. Draggable only when `editable` (the
// Mother/Pastor has entered "Editing Family Positions"); otherwise it's a
// plain tap target that opens that sibling's page — matching the design's
// "Only you can move these — siblings just see the result."
function SiblingNode({ x, y, size, name, avatarUrl, editable, onDragEnd, onTap }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  // PanResponder.create() only runs once — useRef keeps whatever it
  // returned on the very first render and ignores every later call — but
  // this node never unmounts when "Editing Family Positions" is toggled
  // on, so its callbacks were closing over the `editable`/`onDragEnd` from
  // that first render forever. Since every node first mounts with
  // editable=false (edit mode starts off), that stale closure always saw
  // editable as false, so dragging silently never worked. Refs that get
  // refreshed every render fix that without having to recreate the
  // PanResponder.
  const editableRef = useRef(editable);
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => { editableRef.current = editable; }, [editable]);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editableRef.current,
      onMoveShouldSetPanResponder: (evt, gesture) => editableRef.current && (Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2),
      onPanResponderMove: (evt, gesture) => setDrag({ x: gesture.dx, y: gesture.dy }),
      onPanResponderRelease: (evt, gesture) => {
        onDragEndRef.current(gesture.dx, gesture.dy);
        setDrag({ x: 0, y: 0 });
      },
      onPanResponderTerminate: () => setDrag({ x: 0, y: 0 }),
    })
  ).current;

  const nodeStyle = {
    position: 'absolute',
    left: x - size / 2 + drag.x,
    top: y - size / 2 + drag.y,
    alignItems: 'center',
    gap: 4,
  };

  const avatar = (
    <View
      style={[
        styles.siblingAvatar,
        { width: size, height: size, borderRadius: size / 2 },
        editable && styles.siblingAvatarEditing,
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.siblingAvatarText, { fontSize: Math.max(11, size * 0.3) }]}>{initialsFor(name)}</Text>
      )}
      {editable && (
        <View style={styles.dragBadge}>
          <Ionicons name="move" size={10} color={colors.white} />
        </View>
      )}
    </View>
  );

  if (editable) {
    return (
      <View style={nodeStyle} {...panResponder.panHandlers}>
        {avatar}
        <Text style={styles.siblingName} numberOfLines={1}>{name?.split(' ')[0] || 'Member'}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={nodeStyle} activeOpacity={0.7} onPress={onTap}>
      {avatar}
      <Text style={styles.siblingName} numberOfLines={1}>{name?.split(' ')[0] || 'Member'}</Text>
    </TouchableOpacity>
  );
}

// The Family tab's main screen once a family exists (either you lead one,
// or you're an accepted sibling of one). Shows the mind map by default;
// the Mother/Pastor can switch to a pending-requests list or an "editing
// positions" mode via the header controls.
export default function FamilyMindMapScreen({
  session, family, isLeader, myLeaderName, onOpenMotherPage, onOpenGroupChat, onOpenSiblingPage,
}) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]); // family_memberships rows, accepted
  const [people, setPeople] = useState({}); // auth_id -> {name, role, profile_picture_path}
  const [avatarUrls, setAvatarUrls] = useState({}); // profile_picture_path -> signed url
  const [pending, setPending] = useState([]);
  const [view, setView] = useState('map'); // 'map' | 'requests'
  const [editMode, setEditMode] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const myAuthId = session?.user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const [memberRows, pendingRows] = await Promise.all([
      fetchFamilyMembers(family.id),
      isLeader ? fetchPendingRequests(family.id) : Promise.resolve([]),
    ]);
    setMembers(memberRows);
    setPending(pendingRows);
    const ids = [
      family.leader_auth_id,
      ...memberRows.map((m) => m.sibling_auth_id),
      ...pendingRows.map((m) => m.sibling_auth_id),
    ];
    const peopleMap = await fetchAuthorsByAuthId(ids);
    setPeople(peopleMap);
    const paths = Object.values(peopleMap).map((p) => p.profile_picture_path).filter(Boolean);
    setAvatarUrls(await fetchSignedUrls('profile-pictures', paths));
    setLoading(false);
  }, [family.id, family.leader_auth_id, isLeader]);

  useEffect(() => {
    load();
  }, [load]);

  const centerX = canvasSize.width / 2;
  const centerY = canvasSize.height / 2;
  const radiusX = Math.max(0, canvasSize.width / 2 - 40);
  const radiusY = Math.max(0, canvasSize.height / 2 - 60);

  function toScreen(pos_x, pos_y) {
    return { x: centerX + (pos_x || 0) * radiusX, y: centerY + (pos_y || 0) * radiusY };
  }
  function toNormalized(screenX, screenY) {
    const clampedX = Math.max(-1, Math.min(1, (screenX - centerX) / (radiusX || 1)));
    const clampedY = Math.max(-1, Math.min(1, (screenY - centerY) / (radiusY || 1)));
    return { pos_x: clampedX, pos_y: clampedY };
  }

  async function handleDragEnd(membership, dx, dy) {
    const current = toScreen(membership.pos_x, membership.pos_y);
    const next = toNormalized(current.x + dx, current.y + dy);
    setMembers((prev) => prev.map((m) => (m.id === membership.id ? { ...m, ...next } : m)));
    try {
      await updateSiblingPosition(membership.id, next.pos_x, next.pos_y);
    } catch (e) {
      load(); // out of sync — just re-fetch the truth
    }
  }

  async function handleRespond(membership, accept) {
    setPending((prev) => prev.filter((p) => p.id !== membership.id));
    try {
      await respondToRequest(membership, accept, members.length);
      load();
    } catch (e) {
      load();
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  if (view === 'requests') {
    return (
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setView('map')} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.brown} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Requests to Join</Text>
          <View style={styles.headerBtn} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {!pending.length && (
            <Text style={styles.emptyText}>No pending requests right now.</Text>
          )}
          {pending.map((m) => {
            const person = people[m.sibling_auth_id];
            const avatarUrl = person?.profile_picture_path ? avatarUrls[person.profile_picture_path] : null;
            return (
              <View key={m.id} style={styles.requestRow}>
                <View style={styles.requestAvatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.requestAvatarImg} />
                  ) : (
                    <Text style={styles.requestAvatarText}>{initialsFor(person?.name)}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.requestName} numberOfLines={1}>{person?.name || 'Member'}</Text>
                  <Text style={styles.requestMeta}>wants to join your family</Text>
                </View>
                {members.length >= MAX_SIBLINGS ? (
                  <Text style={styles.fullText}>Family full</Text>
                ) : (
                  <View style={styles.requestActions}>
                    <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(m, false)}>
                      <Ionicons name="close" size={16} color={colors.textSoft} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(m, true)}>
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {editMode ? (
        <View style={styles.editHeader}>
          <View>
            <Text style={styles.editHeaderTitle}>Editing Family Positions</Text>
            <Text style={styles.editHeaderSubtitle}>Drag a sibling to change closeness or focus side</Text>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => setEditMode(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: isLeader ? 126 : 44 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isLeader ? 'Your Spiritual Family' : `${myLeaderName || 'Your Mother'}'s Family`}
            </Text>
            <Text style={styles.headerSubtitle}>{members.length} of {MAX_SIBLINGS} seats filled</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenGroupChat}>
              <Ionicons name="chatbubbles-outline" size={19} color={colors.brown} />
            </TouchableOpacity>
            {isLeader && (
              <>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setView('requests')}>
                  <Ionicons name="person-add-outline" size={19} color={colors.brown} />
                  {pending.length > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pending.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setEditMode(true)}>
                  <Ionicons name="move-outline" size={19} color={colors.brown} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      <View
        style={styles.canvas}
        onLayout={(e) => setCanvasSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {canvasSize.width > 0 && (
          <>
            {members.map((m) => {
              const p = toScreen(m.pos_x, m.pos_y);
              return <LineBetween key={`line-${m.id}`} x1={centerX} y1={centerY} x2={p.x} y2={p.y} />;
            })}

            <TouchableOpacity
              style={[styles.leaderNode, { left: centerX - 46, top: centerY - 46 }]}
              activeOpacity={editMode ? 1 : 0.75}
              disabled={editMode}
              onPress={onOpenMotherPage}
            >
              <View style={styles.leaderAvatar}>
                {people[family.leader_auth_id]?.profile_picture_path && avatarUrls[people[family.leader_auth_id].profile_picture_path] ? (
                  <Image
                    source={{ uri: avatarUrls[people[family.leader_auth_id].profile_picture_path] }}
                    style={styles.leaderAvatarImg}
                  />
                ) : (
                  <Text style={styles.leaderAvatarText}>{initialsFor(myLeaderName)}</Text>
                )}
              </View>
              <Text style={styles.leaderName} numberOfLines={1}>{isLeader ? 'You' : (myLeaderName || 'Mother')}</Text>
            </TouchableOpacity>

            {members.map((m) => {
              const p = toScreen(m.pos_x, m.pos_y);
              const dist = Math.min(1, Math.sqrt((m.pos_x || 0) ** 2 + (m.pos_y || 0) ** 2));
              const size = 66 - dist * 28;
              const person = people[m.sibling_auth_id];
              const avatarUrl = person?.profile_picture_path ? avatarUrls[person.profile_picture_path] : null;
              return (
                <SiblingNode
                  key={m.id}
                  x={p.x}
                  y={p.y}
                  size={size}
                  name={person?.name}
                  avatarUrl={avatarUrl}
                  editable={editMode}
                  onDragEnd={(dx, dy) => handleDragEnd(m, dx, dy)}
                  onTap={() => onOpenSiblingPage(m, person)}
                />
              );
            })}
          </>
        )}
      </View>

      <Text style={styles.footnote}>
        {editMode ? 'Only you can move these — siblings just see the result' : 'Distance from center reflects closeness · tap anyone to open their page'}
      </Text>

      {isLeader && !editMode && (
        <TouchableOpacity style={styles.myPageBtn} onPress={onOpenMotherPage} activeOpacity={0.8}>
          <Ionicons name="book-outline" size={16} color={colors.white} />
          <Text style={styles.myPageBtnText}>My Family Page</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { textAlign: 'center', color: colors.textSoft, fontSize: 14, marginTop: 30 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  headerBtn: { width: 32 },
  headerTitle: { fontFamily: serif, fontSize: 18, color: colors.brown, fontWeight: '700' },
  headerSubtitle: { fontSize: 11.5, color: colors.textSoft, marginTop: 2 },
  // Pinned to the right edge instead of sitting in the flex flow: on Android
  // the row could re-measure after leaving edit mode and push the icons off
  // screen. The title column reserves matching space with paddingRight.
  headerActions: { position: 'absolute', right: 0, top: 2, flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDark },
  badge: {
    position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.errorText, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 9.5, fontWeight: '700' },

  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.brown, marginHorizontal: -24, marginTop: -24, paddingHorizontal: 24, paddingVertical: 14, marginBottom: 8,
  },
  editHeaderTitle: { fontFamily: serif, fontSize: 15, color: colors.white, fontWeight: '700' },
  editHeaderSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  doneBtn: { backgroundColor: colors.white, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
  doneBtnText: { color: colors.brown, fontSize: 12.5, fontWeight: '700' },

  canvas: { flex: 1, minHeight: 340, position: 'relative' },

  leaderNode: { position: 'absolute', width: 92, alignItems: 'center', gap: 4 },
  leaderAvatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brown, borderWidth: 3, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  leaderAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 24, color: colors.white },
  leaderAvatarImg: { width: 78, height: 78, borderRadius: 39 },
  leaderName: { fontSize: 12, fontWeight: '700', color: colors.brown },

  siblingAvatar: {
    backgroundColor: colors.creamDark, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
  siblingAvatarEditing: { borderStyle: 'dashed', borderColor: colors.brown, borderWidth: 2 },
  siblingAvatarText: { fontFamily: serif, fontWeight: '700', color: colors.brown },
  dragBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.brown, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  siblingName: { fontSize: 10.5, fontWeight: '700', color: colors.text, maxWidth: 70 },

  footnote: { textAlign: 'center', fontSize: 11, color: colors.textSoft, paddingVertical: 8 },

  myPageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 12, marginTop: 2,
  },
  myPageBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },

  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white,
    borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14, padding: 13, marginTop: 10,
  },
  requestAvatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.creamDark, alignItems: 'center', justifyContent: 'center' },
  requestAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 14, color: colors.brown },
  requestAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  requestName: { fontSize: 14, fontWeight: '700', color: colors.text },
  requestMeta: { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  requestActions: { flexDirection: 'row', gap: 8 },
  declineBtn: { width: 32, height: 32, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(107,66,38,0.2)', alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' },
  fullText: { fontSize: 11, color: colors.textSoft, fontStyle: 'italic' },
});
