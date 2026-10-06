import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert,
  Platform, Keyboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { initialsFor } from '../roleLabels';
import {
  fetchMotherPost, upsertMotherPost, fetchPractices, addPractice, deletePractice,
  fetchMyChecks, toggleCheck, fetchDailyContent, addDailyContent, deleteDailyContent,
} from '../familyApi';
import { fetchAuthorsByAuthId, fetchSignedUrls } from '../postsApi';

// The Mother's/Pastor's own page within her Spiritual Family — matches
// FamilyMotherProfile.dc.html: a weekly focus quote, a "How I'm Doing"
// note, a shared practices checklist, a row of daily content cards, and a
// "Request a 1:1 Call" button (siblings only — see FamilyCallPackagesScreen
// for why that stays a placeholder this round).
//
// The Mother/Pastor can edit her own focus/how-I'm-doing text and manage
// the practices + daily content lists. Accepted siblings get the same
// content read-only, except the practices checklist, which is genuinely
// interactive for them (checking off is per-person, via
// family_practice_checks).
export default function FamilyMotherPageScreen({ session, family, isLeader, leaderName, onBack, onOpenCallPackages }) {
  const myAuthId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [practices, setPractices] = useState([]);
  const [myChecks, setMyChecks] = useState(new Set());
  const [dailyContent, setDailyContent] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  // Plain KeyboardAvoidingView computed zero offset here on a real device —
  // this screen is nested several layers deep (App's card panel -> HomeTabs'
  // tab content -> FamilyScreen -> this screen), same root cause documented
  // in ChatThreadScreen.js/PostCommentsScreen.js. The form fields that need
  // protecting (the "Add Card" title/subtitle inputs) also sit right at the
  // END of the ScrollView's content with almost no bottom padding, so even
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

  const [editingIntro, setEditingIntro] = useState(false);
  const [draftQuote, setDraftQuote] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftHow, setDraftHow] = useState('');
  const [savingIntro, setSavingIntro] = useState(false);

  const [newPractice, setNewPractice] = useState('');
  const [addingPractice, setAddingPractice] = useState(false);

  const [addingDaily, setAddingDaily] = useState(false);
  const [draftDayLabel, setDraftDayLabel] = useState('');
  const [draftDayTitle, setDraftDayTitle] = useState('');
  const [draftDayBody, setDraftDayBody] = useState('');
  const [savingDaily, setSavingDaily] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, prac, checks, daily, authors] = await Promise.all([
      fetchMotherPost(family.id),
      fetchPractices(family.id),
      fetchMyChecks(myAuthId),
      fetchDailyContent(family.id),
      fetchAuthorsByAuthId([family.leader_auth_id]),
    ]);
    setPost(p);
    setPractices(prac);
    setMyChecks(checks);
    setDailyContent(daily);
    const path = authors[family.leader_auth_id]?.profile_picture_path;
    if (path) {
      const urls = await fetchSignedUrls('profile-pictures', [path]);
      setAvatarUrl(urls[path] || null);
    } else {
      setAvatarUrl(null);
    }
    setLoading(false);
  }, [family.id, family.leader_auth_id, myAuthId]);

  useEffect(() => {
    load();
  }, [load]);

  function openIntroEditor() {
    setDraftQuote(post?.focus_quote || '');
    setDraftBody(post?.focus_body || '');
    setDraftHow(post?.how_im_doing || '');
    setEditingIntro(true);
  }

  async function handleSaveIntro() {
    setSavingIntro(true);
    try {
      const fields = { focus_quote: draftQuote.trim(), focus_body: draftBody.trim(), how_im_doing: draftHow.trim() };
      await upsertMotherPost(family.id, fields);
      setPost((prev) => ({ ...(prev || {}), ...fields }));
      setEditingIntro(false);
    } catch (e) {
      Alert.alert('Couldn’t save', 'Please try again in a moment.');
    } finally {
      setSavingIntro(false);
    }
  }

  async function handleAddPractice() {
    const label = newPractice.trim();
    if (!label) return;
    setAddingPractice(true);
    try {
      await addPractice(family.id, label, practices.length);
      setNewPractice('');
      const fresh = await fetchPractices(family.id);
      setPractices(fresh);
    } catch (e) {
      Alert.alert('Couldn’t add that', 'Please try again in a moment.');
    } finally {
      setAddingPractice(false);
    }
  }

  async function handleDeletePractice(id) {
    setPractices((prev) => prev.filter((p) => p.id !== id));
    try {
      await deletePractice(id);
    } catch (e) {
      load();
    }
  }

  async function handleToggleCheck(practiceId) {
    const checked = !myChecks.has(practiceId);
    setMyChecks((prev) => {
      const next = new Set(prev);
      if (checked) next.add(practiceId);
      else next.delete(practiceId);
      return next;
    });
    try {
      await toggleCheck(practiceId, myAuthId, checked);
    } catch (e) {
      load();
    }
  }

  async function handleAddDaily() {
    if (!draftDayTitle.trim()) return;
    setSavingDaily(true);
    try {
      await addDailyContent(family.id, {
        day_label: draftDayLabel.trim() || `Day ${dailyContent.length + 1}`,
        title: draftDayTitle.trim(),
        body: draftDayBody.trim() || null,
      }, dailyContent.length);
      setDraftDayLabel('');
      setDraftDayTitle('');
      setDraftDayBody('');
      setAddingDaily(false);
      const fresh = await fetchDailyContent(family.id);
      setDailyContent(fresh);
    } catch (e) {
      Alert.alert('Couldn’t add that', 'Please try again in a moment.');
    } finally {
      setSavingDaily(false);
    }
  }

  async function handleDeleteDaily(id) {
    setDailyContent((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteDailyContent(id);
    } catch (e) {
      load();
    }
  }

  const displayName = isLeader ? 'You' : (leaderName || 'Your Mother');
  const hasIntro = post?.focus_quote || post?.focus_body || post?.how_im_doing;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.brown} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{isLeader ? 'My Family Page' : `${leaderName || 'Family'}'s Page`}</Text>
        {isLeader && !editingIntro ? (
          <TouchableOpacity style={styles.headerBtn} onPress={openIntroEditor}>
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
                <Text style={styles.identityAvatarText}>{initialsFor(leaderName)}</Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.identityName} numberOfLines={1}>{leaderName || 'Spiritual Family'}</Text>
              <Text style={styles.identityMeta}>{isLeader ? 'Your Spiritual Family' : `Your Spiritual ${family.leader_role === 'pastor' ? 'Pastor' : 'Mother'}`}</Text>
            </View>
          </View>

          {editingIntro ? (
            <View style={styles.editCard}>
              <Text style={styles.editLabel}>This Week's Focus — a short quote</Text>
              <TextInput
                style={styles.input}
                value={draftQuote}
                onChangeText={setDraftQuote}
                placeholder={'"Rest is not the opposite of faithfulness."'}
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <Text style={styles.editLabel}>Supporting line</Text>
              <TextInput
                style={styles.input}
                value={draftBody}
                onChangeText={setDraftBody}
                placeholder="Let's each find one thing to release this week instead of carry."
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <Text style={styles.editLabel}>How I'm Doing</Text>
              <TextInput
                style={[styles.input, styles.inputTall]}
                value={draftHow}
                onChangeText={setDraftHow}
                placeholder="Share how you're really doing this week..."
                placeholderTextColor={colors.textSoft}
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingIntro(false)} disabled={savingIntro}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveIntro} disabled={savingIntro}>
                  {savingIntro ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {hasIntro ? (
                <>
                  {(post?.focus_quote || post?.focus_body) && (
                    <View style={styles.focusCard}>
                      <Text style={styles.focusLabel}>This Week's Focus</Text>
                      {post?.focus_quote ? <Text style={styles.focusQuote}>{post.focus_quote}</Text> : null}
                      {post?.focus_body ? <Text style={styles.focusBody}>{post.focus_body}</Text> : null}
                    </View>
                  )}
                  {post?.how_im_doing ? (
                    <View style={styles.card}>
                      <Text style={styles.cardLabel}>How {isLeader ? "I'm" : `${(leaderName || '').split(' ')[0] || 'She'}'s`} Doing</Text>
                      <Text style={styles.cardBody}>{post.how_im_doing}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardBody}>
                    {isLeader
                      ? "You haven't shared a weekly focus yet — tap the pencil above to write one for your family."
                      : `${leaderName || 'Your Mother'} hasn't shared a weekly focus yet.`}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>Practices To Maintain</Text>
            <View style={styles.practicesCard}>
              {!practices.length && (
                <Text style={styles.emptyRowText}>
                  {isLeader ? 'Add a practice below for your family to keep together.' : 'No practices set yet.'}
                </Text>
              )}
              {practices.map((p, idx) => {
                const checked = myChecks.has(p.id);
                return (
                  <View
                    key={p.id}
                    style={[styles.practiceRow, idx < practices.length - 1 && styles.practiceRowBorder]}
                  >
                    <TouchableOpacity
                      style={styles.checkboxTouch}
                      onPress={() => handleToggleCheck(p.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Ionicons name="checkmark" size={11} color={colors.white} />}
                      </View>
                      <Text style={styles.practiceLabel}>{p.label}</Text>
                    </TouchableOpacity>
                    {isLeader && (
                      <TouchableOpacity onPress={() => handleDeletePractice(p.id)} style={styles.deleteIconBtn}>
                        <Ionicons name="trash-outline" size={15} color={colors.textSoft} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {isLeader && (
                <View style={styles.addPracticeRow}>
                  <TextInput
                    style={styles.addPracticeInput}
                    value={newPractice}
                    onChangeText={setNewPractice}
                    placeholder="Add a practice..."
                    placeholderTextColor={colors.textSoft}
                    onSubmitEditing={handleAddPractice}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddPractice} disabled={addingPractice}>
                    {addingPractice ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="add" size={17} color={colors.white} />}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={styles.dailyHeaderRow}>
              <Text style={styles.sectionLabel}>Daily Practices &amp; Content</Text>
              {isLeader && (
                <TouchableOpacity onPress={() => setAddingDaily((v) => !v)}>
                  <Ionicons name={addingDaily ? 'close' : 'add-circle-outline'} size={19} color={colors.brown} />
                </TouchableOpacity>
              )}
            </View>

            {isLeader && addingDaily && (
              <View style={styles.dailyAddCard}>
                <TextInput
                  style={styles.addPracticeInput}
                  value={draftDayLabel}
                  onChangeText={setDraftDayLabel}
                  placeholder="Label, e.g. Day 3"
                  placeholderTextColor={colors.textSoft}
                />
                <TextInput
                  style={styles.addPracticeInput}
                  value={draftDayTitle}
                  onChangeText={setDraftDayTitle}
                  placeholder="Title, e.g. Morning Devotional"
                  placeholderTextColor={colors.textSoft}
                />
                <TextInput
                  style={styles.addPracticeInput}
                  value={draftDayBody}
                  onChangeText={setDraftDayBody}
                  placeholder="Subtitle, e.g. Psalm 23 reflection"
                  placeholderTextColor={colors.textSoft}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddDaily} disabled={savingDaily}>
                  {savingDaily ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Add Card</Text>}
                </TouchableOpacity>
              </View>
            )}

            {dailyContent.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {dailyContent.map((d) => (
                  <View key={d.id} style={styles.dailyCard}>
                    <View style={styles.dailyBadgeRow}>
                      <View style={styles.dailyBadge}>
                        <Text style={styles.dailyBadgeText}>{(d.day_label || '').toUpperCase()}</Text>
                      </View>
                      {isLeader && (
                        <TouchableOpacity onPress={() => handleDeleteDaily(d.id)}>
                          <Ionicons name="trash-outline" size={13} color={colors.textSoft} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.dailyTitle} numberOfLines={2}>{d.title}</Text>
                    {d.body ? <Text style={styles.dailySubtitle} numberOfLines={2}>{d.body}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            ) : (
              !addingDaily && (
                <Text style={styles.emptyRowText}>
                  {isLeader ? 'Add daily devotionals or content for your family below.' : 'No daily content yet.'}
                </Text>
              )
            )}
          </View>

          {!isLeader && (
            <View style={styles.callCard}>
              <Ionicons name="call-outline" size={22} color={colors.brown} />
              <Text style={styles.callTitle}>Need a 1:1 moment?</Text>
              <Text style={styles.callBody}>Book a private call with {leaderName || 'her'}, from a call package.</Text>
              <TouchableOpacity style={styles.callBtn} onPress={onOpenCallPackages} activeOpacity={0.85}>
                <Text style={styles.callBtnText}>Request a 1:1 Call</Text>
              </TouchableOpacity>
            </View>
          )}
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
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brown,
    alignItems: 'center', justifyContent: 'center',
  },
  identityAvatarText: { fontFamily: serif, fontWeight: '700', fontSize: 16, color: colors.white },
  identityAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  identityName: { fontSize: 15, fontWeight: '700', color: colors.text },
  identityMeta: { fontSize: 12, color: colors.textSoft, marginTop: 1 },

  focusCard: { backgroundColor: colors.brown, borderRadius: 14, padding: 16, gap: 6 },
  focusLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: 'rgba(255,255,255,0.75)' },
  focusQuote: { fontFamily: serif, fontSize: 17, fontWeight: '700', color: colors.white, lineHeight: 23 },
  focusBody: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 19 },

  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 15, gap: 6,
  },
  cardLabel: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.brownLight },
  cardBody: { fontSize: 13.5, color: colors.text, lineHeight: 20 },

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

  sectionLabel: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.brownLight, paddingLeft: 2 },
  emptyRowText: { fontSize: 12.5, color: colors.textSoft, padding: 14, lineHeight: 18 },

  practicesCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14, overflow: 'hidden' },
  practiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  practiceRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)' },
  checkboxTouch: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2, borderColor: colors.brownPale, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brown, borderColor: colors.brown },
  practiceLabel: { fontSize: 13, color: colors.text, flexShrink: 1 },
  deleteIconBtn: { padding: 4 },
  addPracticeRow: { flexDirection: 'row', gap: 8, padding: 12, alignItems: 'center' },
  addPracticeInput: {
    flex: 1, backgroundColor: colors.cream, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(107,66,38,0.14)',
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: colors.text,
  },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brown, alignItems: 'center', justifyContent: 'center' },

  dailyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 2 },
  dailyAddCard: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 14, gap: 8,
  },
  dailyCard: {
    minWidth: 150, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 12,
    padding: 12, gap: 6,
  },
  dailyBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dailyBadge: { backgroundColor: colors.creamDark, borderRadius: 5, paddingVertical: 3, paddingHorizontal: 8, alignSelf: 'flex-start' },
  dailyBadgeText: { fontSize: 9.5, fontWeight: '700', color: colors.brown },
  dailyTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  dailySubtitle: { fontSize: 11, color: colors.textSoft },

  callCard: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(107,66,38,0.12)', borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 6,
  },
  callTitle: { fontFamily: serif, fontSize: 15, fontWeight: '700', color: colors.brown },
  callBody: { fontSize: 12.5, color: colors.textSoft, textAlign: 'center', lineHeight: 18 },
  callBtn: { alignSelf: 'stretch', backgroundColor: colors.brown, borderRadius: 999, paddingVertical: 11, alignItems: 'center', marginTop: 4, overflow: 'visible' },
  callBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '700' },
});
