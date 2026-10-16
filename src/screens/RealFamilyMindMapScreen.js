import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, PanResponder } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import { fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';
import { fetchRealFamilyMembers, updateRealFamilyMemberPosition } from '../realFamilyApi';

// A straight connector line between two points — identical approach to
// FamilyMindMapScreen's LineBetween (no react-native-svg dependency here).
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

// One member's avatar on the map — same drag-when-editable behavior as
// FamilyMindMapScreen's SiblingNode, renamed since "sibling" doesn't fit a
// real family's mixed relationships (parents, kids, spouses...).
function MemberNode({ x, y, size, name, avatarUrl, editable, onDragEnd, onTap }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });

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
        styles.memberAvatar,
        { width: size, height: size, borderRadius: size / 2 },
        editable && styles.memberAvatarEditing,
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.memberAvatarText, { fontSize: Math.max(11, size * 0.3) }]}>{initialsFor(name)}</Text>
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
        <Text style={styles.memberName} numberOfLines={1}>{name?.split(' ')[0] || 'Member'}</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={nodeStyle} activeOpacity={0.7} onPress={onTap}>
      {avatar}
      <Text style={styles.memberName} numberOfLines={1}>{name?.split(' ')[0] || 'Member'}</Text>
    </TouchableOpacity>
  );
}

// The "My Family" tab's main screen once a real family exists (either you
// own one, or you're an accepted member of one) — mirrors
// FamilyMindMapScreen's shape closely, with the differences Real Family
// needs: no 6-seat cap or "X of 6" copy, the person-add icon opens an
// invite flow (owner invites OUT, rather than siblings requesting IN), and
// the center node isn't tappable into a mentorship-style "My Family Page"
// — there isn't one for Real Family, per the simpler per-member pages
// decision (see RealFamilyMemberPageScreen).
export default function RealFamilyMindMapScreen({
  session, family, isOwner, ownerName, onOpenGroupChat, onOpenInvite, onOpenMemberPage,
}) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]); // real_family_members rows, accepted
  const [people, setPeople] = useState({}); // auth_id -> {name, role, profile_picture_path}
  const [avatarUrls, setAvatarUrls] = useState({}); // profile_picture_path -> signed url
  const [editMode, setEditMode] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const myAuthId = session?.user?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const memberRows = await fetchRealFamilyMembers(family.id);
    setMembers(memberRows);
    const ids = [family.owner_auth_id, ...memberRows.map((m) => m.member_auth_id)];
    const peopleMap = await fetchAuthorsByAuthId(ids);
    setPeople(peopleMap);
    const paths = Object.values(peopleMap).map((p) => p.profile_picture_path).filter(Boolean);
    setAvatarUrls(await fetchSignedUrls('profile-pictures', paths));
    setLoading(false);
  }, [family.id, family.owner_auth_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-load every time this screen becomes the active one again (e.g.
  // coming back from the invite screen after sending one) — there's no
  // navigation-focus event in this app's plain-state routing, so the
  // parent just re-mounts/re-keys this screen when it wants a refresh;
  // exposing load() this way isn't needed since the parent already does
  // that by calling back through onOpenInvite's return path.

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
      await updateRealFamilyMemberPosition(membership.id, next.pos_x, next.pos_y);
    } catch (e) {
      load(); // out of sync — just re-fetch the truth
    }
  }

  const familyTitle = family.family_name || (isOwner ? 'Your Family' : `${ownerName || 'Their'} Family`);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brown} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {editMode ? (
        <View style={styles.editHeader}>
          <View>
            <Text style={styles.editHeaderTitle}>Editing Family Positions</Text>
            <Text style={styles.editHeaderSubtitle}>Drag a member to change closeness or focus side</Text>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => setEditMode(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: isOwner ? 126 : 44 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{familyTitle}</Text>
            <Text style={styles.headerSubtitle}>{members.length} member{members.length === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenGroupChat}>
              <Ionicons name="chatbubbles-outline" size={19} color={colors.brown} />
            </TouchableOpacity>
            {isOwner && (
              <>
                <TouchableOpacity style={styles.iconBtn} onPress={onOpenInvite}>
                  <Ionicons name="person-add-outline" size={19} color={colors.brown} />
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

            <View style={[styles.ownerNode, { left: centerX - 46, top: centerY - 46 }]}>
              <View style={styles.ownerAvatar}>
                {people[family.owner_auth_id]?.profile_picture_path && avatarUrls[people[family.owner_auth_id].profile_picture_path] ? (
                  <Image
                    source={{ uri: avatarUrls[people[family.owner_auth_id].profile_picture_path] }}
                    style={styles.ownerAvatarImg}
                  />
                ) : (
                  <Text style={styles.ownerAvatarText}>{initialsFor(isOwner ? people[family.owner_auth_id]?.name : ownerName)}</Text>
                )}
              </View>
              <Text style={styles.ownerName} numberOfLines={1}>{isOwner ? 'You' : (ownerName || 'Owner')}</Text>
            </View>

            {members.map((m) => {
              const p = toScreen(m.pos_x, m.pos_y);
              const dist = Math.min(1, Math.sqrt((m.pos_x || 0) ** 2 + (m.pos_y || 0) ** 2));
              const size = 66 - dist * 28;
              const person = people[m.member_auth_id];
              const avatarUrl = person?.profile_picture_path ? avatarUrls[person.profile_picture_path] : null;
              return (
                <MemberNode
                  key={m.id}
                  x={p.x}
                  y={p.y}
                  size={size}
                  name={person?.name}
                  avatarUrl={avatarUrl}
                  editable={editMode}
                  onDragEnd={(dx, dy) => handleDragEnd(m, dx, dy)}
                  onTap={() => onOpenMemberPage(m, person)}
                />
              );
            })}
          </>
        )}
      </View>

      <Text style={styles.footnote}>
        {editMode ? 'Only you can move these — others just see the result' : 'Distance from center reflects closeness · tap anyone to open their page'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  headerTitle: { fontFamily: serif, fontSize: 18, color: colors.brown, fontWeight: '700' },
  headerSubtitle: { fontSize: 11.5, color: colors.textSoft, marginTop: 2 },
  // Pinned to the right edge instead of sitting in the flex flow: on Android
  // the row could re-measure after leaving edit mode and push the icons off
  // screen. The title column reserves matching space with paddingRight.
  headerActions: { position: 'absolute', right: 0, top: 2, flexDirection: 'row', gap: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.creamDark },

  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.brown, marginHorizontal: -24, marginTop: -24, paddingHorizontal: 24, paddingVertical: 14, marginBottom: 8,
  },
  editHeaderTitle: { fontFamily: serif, fontSize: 15, color: colors.white, fontWeight: '700' },
  editHeaderSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  doneBtn: { backgroundColor: colors.white, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 16 },
  doneBtnText: { color: colors.brown, fontSize: 12.5, fontWeight: '700' },

  canvas: { flex: 1, minHeight: 340, position: 'relative' },

  ownerNode: { position: 'absolute', width: 92, alignItems: 'center', gap: 4 },
  ownerAvatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brown, borderWidth: 3, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  ownerAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 24, color: colors.white },
  ownerAvatarImg: { width: 78, height: 78, borderRadius: 39 },
  ownerName: { fontSize: 12, fontWeight: '700', color: colors.brown },

  memberAvatar: {
    backgroundColor: colors.creamDark, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
  memberAvatarEditing: { borderStyle: 'dashed', borderColor: colors.brown, borderWidth: 2 },
  memberAvatarText: { fontFamily: serif, fontWeight: '700', color: colors.brown },
  dragBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.brown, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  memberName: { fontSize: 10.5, fontWeight: '700', color: colors.text, maxWidth: 70 },

  footnote: { textAlign: 'center', fontSize: 11, color: colors.textSoft, paddingVertical: 8 },
});
