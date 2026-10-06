import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, Linking,
  Platform, Keyboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import { fetchSiblingUpdate, upsertMyUpdate, fetchPrivateNote, upsertMyPrivateNote, upsertMotherResponse, updateMotherGuidance } from '../familyApi';
import { fetchCreatorHandle, fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';
import { WEB_BASE_URL } from '../config';

// Starter text dropped into the Mother's/Pastor's own guidance box the
// first time she opens it, so she's editing a useful draft rather than a
// blank field. Once she saves anything, HER text is what's stored and
// shown from then on — she can rewrite the do's/don'ts, delete them, or
// add her own sections entirely; nothing here is enforced structure.
const DEFAULT_GUIDANCE_TEMPLATE = `Do's
- Listen first — let them finish sharing before offering guidance.
- Check in consistently, even with a short message, so they feel remembered.
- Pray for them by name, not just "the family" in general.
- Celebrate small wins — consistency matters more than big breakthroughs.

Don'ts
- Don't share what they've told you with others, even other siblings.
- Don't rush their healing or compare their journey to someone else's.
- Don't let silence from them read as rejection — check in instead of assuming.
- Don't make promises (about time or availability) you can't consistently keep.`;

// One sibling's shared-update page — matches FamilySiblingProfile.dc.html.
// Reachable by tapping any sibling node on the mind map, from the Mother/
// Pastor's own map or another sibling's. The weekly share (This Week +
// Personal/Career/Love) is visible to the whole family, matching the
// design's "Shared in confidence with your Spiritual Family only" — but
// only the sibling themselves can edit it. The private note underneath is
// a separate, stricter layer: only the sibling and their Mother/Pastor can
// even see it exists (family_private_notes has its own RLS), so it's kept
// out of the page entirely for any other viewer rather than shown blank.
export default function FamilySiblingPageScreen({ session, family, targetAuthId, targetName, viewerIsMother, onBack }) {
  const myAuthId = session?.user?.id;
  const isSelf = myAuthId === targetAuthId;
  const canSeePrivateNote = viewerIsMother || isSelf;

  const [loading, setLoading] = useState(true);
  const [update, setUpdate] = useState(null);
  const [note, setNote] = useState(null);

  const [editingShare, setEditingShare] = useState(false);
  const [draftThisWeek, setDraftThisWeek] = useState('');
  const [draftPersonal, setDraftPersonal] = useState('');
  const [draftCareer, setDraftCareer] = useState('');
  const [draftLove, setDraftLove] = useState('');
  const [savingShare, setSavingShare] = useState(false);

  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [editingResponse, setEditingResponse] = useState(false);
  const [draftResponse, setDraftResponse] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);

  const [leaderHandle, setLeaderHandle] = useState(null);

  const [guidance, setGuidance] = useState(family.mother_guidance || null);
  const [editingGuidance, setEditingGuidance] = useState(false);
  const [draftGuidance, setDraftGuidance] = useState('');
  const [savingGuidance, setSavingGuidance] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(null);

  // Plain KeyboardAvoidingView computed zero offset here on a real device —
  // this screen is nested several layers deep (App's card panel -> HomeTabs'
  // tab content -> FamilyScreen -> this screen), same root cause documented
  // in ChatThreadScreen.js/PostCommentsScreen.js. Several of this screen's
  // edit boxes (the note, the response, the guidance editor) sit close to
  // the end of the ScrollView's content with little bottom padding, so even
  // ScrollView's own built-in "scroll focused input into view" has nowhere
  // left to scroll to. Tracking the real keyboard height and feeding it in
  // as extra bottom padding gives it that room, without depending on
  // KeyboardAvoidingView at all.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKeyboardHeight(e?.endCoordinates?.height || 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, handle, authors] = await Promise.all([
      fetchSiblingUpdate(targetAuthId),
      fetchCreatorHandle(family.leader_auth_id),
      fetchAuthorsByAuthId([targetAuthId]),
    ]);
    setUpdate(u);
    setLeaderHandle(handle);
    const path = authors[targetAuthId]?.profile_picture_path;
    if (path) {
      const urls = await fetchSignedUrls('profile-pictures', [path]);
      setAvatarUrl(urls[path] || null);
    } else {
      setAvatarUrl(null);
    }
    if (canSeePrivateNote) {
      const n = await fetchPrivateNote(targetAuthId);
      setNote(n);
    }
    setLoading(false);
  }, [targetAuthId, canSeePrivateNote, family.leader_auth_id]);

  useEffect(() => {
    load();
  }, [load]);

  function openShareEditor() {
    setDraftThisWeek(update?.this_week || '');
    setDraftPersonal(update?.personal_update || '');
    setDraftCareer(update?.career_update || '');
    setDraftLove(update?.love_update || '');
    setEditingShare(true);
  }

  async function handleSaveShare() {
    setSavingShare(true);
    try {
      const fields = {
        this_week: draftThisWeek.trim(),
        personal_update: draftPersonal.trim(),
        career_update: draftCareer.trim(),
        love_update: draftLove.trim(),
      };
      await upsertMyUpdate(myAuthId, family.id, fields);
      setUpdate((prev) => ({ ...(prev || {}), ...fields }));
      setEditingShare(false);
    } catch (e) {
      Alert.alert('Couldn’t save', 'Please try again in a moment.');
    } finally {
      setSavingShare(false);
    }
  }

  function openNoteEditor() {
    setDraftNote(note?.note || '');
    setEditingNote(true);
  }

  async function handleSaveNote() {
    setSavingNote(true);
    try {
      const trimmed = draftNote.trim();
      await upsertMyPrivateNote(myAuthId, family.id, trimmed);
      // Merge rather than replace — a fresh { note: trimmed } object would
      // otherwise wipe mother_response out of local state until the next
      // reload, even though the upsert itself never touched that column.
      setNote((prev) => ({ ...(prev || {}), note: trimmed }));
      setEditingNote(false);
    } catch (e) {
      Alert.alert('Couldn’t save', 'Please try again in a moment.');
    } finally {
      setSavingNote(false);
    }
  }

  function openResponseEditor() {
    setDraftResponse(note?.mother_response || '');
    setEditingResponse(true);
  }

  async function handleSaveResponse() {
    setSavingResponse(true);
    try {
      const trimmed = draftResponse.trim();
      await upsertMotherResponse(family.id, targetAuthId, trimmed);
      setNote((prev) => ({ ...(prev || {}), mother_response: trimmed }));
      setEditingResponse(false);
    } catch (e) {
      Alert.alert('Couldn’t save', 'Please try again in a moment.');
    } finally {
      setSavingResponse(false);
    }
  }

  function openGuidanceEditor() {
    setDraftGuidance(guidance || DEFAULT_GUIDANCE_TEMPLATE);
    setEditingGuidance(true);
  }

  async function handleSaveGuidance() {
    setSavingGuidance(true);
    try {
      const trimmed = draftGuidance.trim();
      await updateMotherGuidance(family.id, trimmed);
      setGuidance(trimmed);
      setEditingGuidance(false);
    } catch (e) {
      Alert.alert('Couldn’t save', 'Please try again in a moment.');
    } finally {
      setSavingGuidance(false);
    }
  }

  function handleBookCall() {
    if (!leaderHandle) {
      Alert.alert(
        'Not set up yet',
        `${family.leader_role === 'pastor' ? 'Your Pastor hasn’t' : 'Your Spiritual Mother hasn’t'} set up call booking yet.`
      );
      return;
    }
    Linking.openURL(`${WEB_BASE_URL}/creator/${leaderHandle}#book-a-call`);
  }

  const categories = [
    { key: 'personal_update', label: 'PERSONAL' },
    { key: 'career_update', label: 'CAREER' },
    { key: 'love_update', label: 'LOVE' },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.brown} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{targetName || 'Family Member'}</Text>
        {isSelf && !editingShare ? (
          <TouchableOpacity style={styles.headerBtn} onPress={openShareEditor}>
            <Ionicons name="create-outline" size={19} color={colors.brown} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brown} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 + keyboardHeight, gap: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.identityRow}>
            <View style={styles.identityAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.identityAvatarImg} />
              ) : (
                <Text style={styles.identityAvatarText}>{initialsFor(targetName)}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.identityName} numberOfLines={1}>{targetName || 'Family Member'}</Text>
              <Text style={styles.identityMeta}>Growing together in your Spiritual Family</Text>
            </View>
          </View>

          {editingShare ? (
            <View style={styles.editCard}>
              <Text style={styles.editLabel}>This Week</Text>
              <TextInput
                style={[styles.input, styles.inputTall]}
                value={draftThisWeek}
                onChangeText={setDraftThisWeek}
                placeholder="How has this week actually been for you?"
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <Text style={styles.editLabel}>Personal</Text>
              <TextInput
                style={styles.input}
                value={draftPersonal}
                onChangeText={setDraftPersonal}
                placeholder="What's going on personally..."
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <Text style={styles.editLabel}>Career</Text>
              <TextInput
                style={styles.input}
                value={draftCareer}
                onChangeText={setDraftCareer}
                placeholder="What's going on with work..."
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <Text style={styles.editLabel}>Love Life</Text>
              <TextInput
                style={styles.input}
                value={draftLove}
                onChangeText={setDraftLove}
                placeholder="What's going on with relationships..."
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingShare(false)} disabled={savingShare}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveShare} disabled={savingShare}>
                  {savingShare ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {update?.this_week ? (
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>This Week</Text>
                  <Text style={styles.cardBody}>{update.this_week}</Text>
                </View>
              ) : null}

              {categories.some((c) => update?.[c.key]) ? (
                <View style={{ gap: 8 }}>
                  <Text style={styles.sectionLabel}>Life Update</Text>
                  {categories.map((c) => (
                    update?.[c.key] ? (
                      <View key={c.key} style={styles.updateCard}>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{c.label}</Text>
                        </View>
                        <Text style={styles.cardBody}>{update[c.key]}</Text>
                      </View>
                    ) : null
                  ))}
                </View>
              ) : null}

              {!update?.this_week && !categories.some((c) => update?.[c.key]) && (
                <View style={styles.card}>
                  <Text style={styles.cardBody}>
                    {isSelf ? "You haven't shared an update yet — tap the pencil above to write one." : `${targetName || 'They'} haven't shared an update yet.`}
                  </Text>
                </View>
              )}

              <Text style={styles.confidenceNote}>Shared in confidence with your Spiritual Family only</Text>
            </>
          )}

          {canSeePrivateNote && (
            <View style={styles.privateCard}>
              <View style={styles.privateHeaderRow}>
                <Ionicons name="lock-closed-outline" size={15} color={colors.brown} />
                <Text style={styles.privateHeaderText}>Present Challenges</Text>
              </View>
              <Text style={styles.privateSubtext}>
                {viewerIsMother && !isSelf
                  ? `Only you and ${targetName || 'they'} can see this.`
                  : `Only your Spiritual ${family.leader_role === 'pastor' ? 'Pastor' : 'Mother'} sees this — not shared with the rest of the family.`}
              </Text>

              {editingNote ? (
                <>
                  <TextInput
                    style={[styles.input, styles.inputTall, { backgroundColor: colors.white }]}
                    value={draftNote}
                    onChangeText={setDraftNote}
                    placeholder="What are you facing right now?"
                    placeholderTextColor={colors.textSoft}
                    multiline
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingNote(false)} disabled={savingNote}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNote} disabled={savingNote}>
                      {savingNote ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Send privately</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.noteBox}>
                    <Text style={note?.note ? styles.noteText : styles.notePlaceholder}>
                      {note?.note || (isSelf ? 'Write about what you’re facing right now...' : 'Nothing written yet.')}
                    </Text>
                  </View>
                  {isSelf && (
                    <TouchableOpacity style={styles.sendPrivatelyBtn} onPress={openNoteEditor} activeOpacity={0.85}>
                      <Text style={styles.sendPrivatelyText}>{note?.note ? 'Edit privately' : 'Send privately'}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <View style={styles.responseDivider} />

              <View style={styles.privateHeaderRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.brown} />
                <Text style={styles.privateHeaderText}>
                  {family.leader_role === 'pastor' ? "Pastor's" : "Spiritual Mother's"} Response
                </Text>
              </View>

              {viewerIsMother && !isSelf ? (
                editingResponse ? (
                  <>
                    <TextInput
                      style={[styles.input, styles.inputTall, { backgroundColor: colors.white }]}
                      value={draftResponse}
                      onChangeText={setDraftResponse}
                      placeholder={`Write something back to ${targetName || 'them'}...`}
                      placeholderTextColor={colors.textSoft}
                      multiline
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingResponse(false)} disabled={savingResponse}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveBtn} onPress={handleSaveResponse} disabled={savingResponse}>
                        {savingResponse ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save response</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.noteBox}>
                      <Text style={note?.mother_response ? styles.noteText : styles.notePlaceholder}>
                        {note?.mother_response || `Write something back to ${targetName || 'them'}...`}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.sendPrivatelyBtn} onPress={openResponseEditor} activeOpacity={0.85}>
                      <Text style={styles.sendPrivatelyText}>{note?.mother_response ? 'Edit response' : 'Respond'}</Text>
                    </TouchableOpacity>
                  </>
                )
              ) : (
                <View style={styles.noteBox}>
                  <Text style={note?.mother_response ? styles.noteText : styles.notePlaceholder}>
                    {note?.mother_response || 'No response yet.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {viewerIsMother && !isSelf && (
            <View style={styles.dosDontsCard}>
              <View style={styles.dosDontsHeaderRow}>
                <View style={styles.privateHeaderRow}>
                  <Ionicons name="create-outline" size={15} color={colors.brown} />
                  <Text style={styles.dosDontsTitle}>Guidance for You</Text>
                </View>
                {!editingGuidance && (
                  <TouchableOpacity onPress={openGuidanceEditor} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="pencil-outline" size={16} color={colors.brown} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.dosDontsHint}>
                Your own notes to yourself — do's, don'ts, or anything else you want to remember while supporting {targetName || 'them'}. Fully yours to write, edit, and organize however you like.
              </Text>

              {editingGuidance ? (
                <>
                  <TextInput
                    style={[styles.input, styles.inputGuidance, { backgroundColor: colors.cream }]}
                    value={draftGuidance}
                    onChangeText={setDraftGuidance}
                    placeholder={DEFAULT_GUIDANCE_TEMPLATE}
                    placeholderTextColor={colors.textSoft}
                    multiline
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingGuidance(false)} disabled={savingGuidance}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGuidance} disabled={savingGuidance}>
                      {savingGuidance ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.guidanceText}>{guidance || DEFAULT_GUIDANCE_TEMPLATE}</Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.bookCallBtn} onPress={handleBookCall} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={17} color={colors.white} />
            <Text style={styles.bookCallText}>Book a Call</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  headerBtn: { width: 32, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: serif, fontSize: 16, color: colors.brown, fontWeight: '700' },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.creamDark,
    alignItems: 'center', justifyContent: 'center',
  },
  identityAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 16, color: colors.brown },
  identityAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  identityName: { fontSize: 15, fontWeight: '700', color: colors.text },
  identityMeta: { fontSize: 12, color: colors.textSoft, marginTop: 1 },

  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 15, gap: 6,
  },
  cardLabel: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.brownLight },
  cardBody: { fontSize: 13.5, color: colors.text, lineHeight: 20 },

  sectionLabel: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.brownLight, paddingLeft: 2 },
  updateCard: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 13, gap: 5, marginTop: 6,
  },
  categoryBadge: { backgroundColor: colors.creamDark, borderRadius: 6, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' },
  categoryBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, color: colors.brown },

  confidenceNote: { textAlign: 'center', fontSize: 11, color: colors.textSoft },

  editCard: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 16, gap: 8,
  },
  editLabel: { fontSize: 11.5, fontWeight: '700', color: colors.brownLight, marginTop: 6 },
  input: {
    backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(107,66,38,0.14)',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: colors.text, minHeight: 40,
  },
  inputTall: { minHeight: 70, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.brownPale },
  cancelBtnText: { color: colors.brown, fontSize: 13.5, fontWeight: '700' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 999, backgroundColor: colors.brown, overflow: 'visible' },
  saveBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },

  privateCard: {
    backgroundColor: colors.creamDark, borderWidth: 1, borderColor: 'rgba(107,66,38,0.18)', borderRadius: 14,
    padding: 15, gap: 8,
  },
  privateHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  privateHeaderText: { fontSize: 12.5, fontWeight: '700', color: colors.brown, textTransform: 'uppercase', letterSpacing: 0.4 },
  privateSubtext: { fontSize: 12.5, color: colors.textSoft, lineHeight: 18 },
  noteBox: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.14)', borderRadius: 10, padding: 12,
  },
  noteText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  notePlaceholder: { fontSize: 13, color: colors.textSoft },
  sendPrivatelyBtn: { alignSelf: 'flex-end', backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18, overflow: 'visible' },
  sendPrivatelyText: { color: colors.white, fontSize: 12.5, fontWeight: '700' },
  responseDivider: { height: 1, backgroundColor: 'rgba(107,66,38,0.14)', marginVertical: 4 },

  dosDontsCard: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 15, gap: 8,
  },
  dosDontsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dosDontsTitle: { fontFamily: serif, fontSize: 14.5, color: colors.brown, fontWeight: '700' },
  dosDontsHint: { fontSize: 12, color: colors.textSoft, lineHeight: 17 },
  inputGuidance: { minHeight: 180, textAlignVertical: 'top' },
  guidanceText: { fontSize: 13, color: colors.text, lineHeight: 20 },

  bookCallBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 13, overflow: 'visible',
  },
  bookCallText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
