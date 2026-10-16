import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, serif } from '../theme';
import { REPORT_REASONS, reportContent, blockUser } from '../moderationApi';

// The "…" button (and its bottom sheet) that puts Report and Block on every
// piece of other people's content: posts, comments, messages, profiles.
//
//   <ReportBlockMenu
//     myAuthId={...}            // signed-in person (never shown for own content)
//     targetAuthId={...}        // who wrote the content / whose profile it is
//     targetName="Name"         // used in the "Block Name" wording
//     contentType="post"        // see CONTENT_TYPES in moderationApi.js
//     contentId={post.id}       // omit for a profile report
//     onReported={() => ...}    // after a successful report (hide the item)
//     onBlocked={() => ...}     // after a successful block (refresh the screen)
//   />
//
// ReportBlockSheet is the same sheet without the button, for screens that
// open it some other way (e.g. long-pressing a chat message).
export default function ReportBlockMenu({ myAuthId, targetAuthId, size = 18, style, ...sheetProps }) {
  const [open, setOpen] = useState(false);
  if (!targetAuthId || targetAuthId === myAuthId) return null;
  return (
    <>
      <TouchableOpacity
        style={[styles.moreBtn, style]}
        onPress={() => setOpen(true)}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="More options: report or block"
      >
        <Ionicons name="ellipsis-horizontal" size={size} color={colors.textSoft} />
      </TouchableOpacity>
      <ReportBlockSheet
        visible={open}
        onClose={() => setOpen(false)}
        myAuthId={myAuthId}
        targetAuthId={targetAuthId}
        {...sheetProps}
      />
    </>
  );
}

export function ReportBlockSheet({
  visible, onClose, myAuthId, targetAuthId, targetName, contentType, contentId = null,
  onReported, onBlocked, noun = 'content',
}) {
  // 'menu' -> choose Report / Block; 'reasons' -> pick a reason; 'done' -> thanks
  const [step, setStep] = useState('menu');
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [didReport, setDidReport] = useState(false);

  const who = targetName || 'this person';

  function close() {
    onClose && onClose();
    // Hide the reported item only once the sheet is dismissed, so the
    // "Thank you" step (with its Block option) isn't yanked away mid-read.
    if (didReport) onReported && onReported();
    // Reset after the sheet has animated away so it doesn't flash.
    setTimeout(() => {
      setStep('menu');
      setReason(null);
      setDetails('');
      setError(null);
      setBusy(false);
      setDidReport(false);
    }, 250);
  }

  async function submitReport() {
    if (!reason) {
      setError('Please choose a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportContent({
        contentType,
        contentId,
        reportedUserId: targetAuthId,
        reason,
        details,
      });
      setDidReport(true);
      setStep('done');
    } catch (e) {
      setError('Couldn’t send your report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock() {
    Alert.alert(
      `Block ${who}?`,
      `You won’t see ${who}’s posts, comments or messages, and they won’t be able to see yours or message you. You can unblock them any time from Profile → Blocked users.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await blockUser(myAuthId, targetAuthId);
              close();
              onBlocked && onBlocked();
            } catch (e) {
              setBusy(false);
              setError('Couldn’t block right now. Please try again.');
            }
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={close} />
        <View style={styles.sheet}>
          {step === 'menu' && (
            <>
              <Text style={styles.sheetTitle}>What would you like to do?</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity style={styles.row} onPress={() => { setError(null); setStep('reasons'); }} disabled={busy}>
                <Ionicons name="flag-outline" size={20} color={colors.brown} />
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>Report {noun}</Text>
                  <Text style={styles.rowSub}>Tell us what’s wrong. Reports are private.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={confirmBlock} disabled={busy}>
                <Ionicons name="ban-outline" size={20} color={colors.errorText} />
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, { color: colors.errorText }]}>Block {who}</Text>
                  <Text style={styles.rowSub}>Hide everything from them and stop messages.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'reasons' && (
            <>
              <Text style={styles.sheetTitle}>Why are you reporting this?</Text>
              <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                {REPORT_REASONS.map((r) => {
                  const selected = reason === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                      onPress={() => { setReason(r.key); setError(null); }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selected ? colors.brown : colors.textSoft}
                      />
                      <Text style={styles.reasonLabel}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TextInput
                  style={styles.detailsInput}
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Add details (optional)"
                  placeholderTextColor={colors.textSoft}
                  multiline
                  maxLength={1000}
                />
              </ScrollView>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submitReport} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Submit report</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('menu')} disabled={busy}>
                <Text style={styles.cancelText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark-circle" size={44} color={colors.successText} />
              </View>
              <Text style={styles.sheetTitle}>Thank you</Text>
              <Text style={styles.doneText}>
                We’ve received your report and will review it. If you don’t want to see {who} any more, you can also block them.
              </Text>
              <TouchableOpacity style={styles.row} onPress={confirmBlock} disabled={busy}>
                <Ionicons name="ban-outline" size={20} color={colors.errorText} />
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowTitle, { color: colors.errorText }]}>Block {who}</Text>
                </View>
              </TouchableOpacity>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={close}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  moreBtn: { padding: 4, overflow: 'visible' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,33,24,0.45)' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28,
  },
  sheetTitle: { fontFamily: serif, fontSize: 19, color: colors.brown, fontWeight: '700', marginBottom: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,66,38,0.1)',
  },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 15.5, color: colors.text, fontWeight: '700' },
  rowSub: { fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { fontSize: 15, color: colors.textSoft, fontWeight: '600' },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
  },
  reasonRowSelected: { backgroundColor: colors.creamDark },
  reasonLabel: { fontSize: 15, color: colors.text, flex: 1 },
  detailsInput: {
    borderWidth: 1, borderColor: colors.brownPale, borderRadius: 10, padding: 12, minHeight: 70,
    fontSize: 14.5, color: colors.text, marginTop: 10, textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: colors.brown, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, marginTop: 14, overflow: 'visible',
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  errorText: { color: colors.errorText, fontSize: 13.5, marginTop: 8 },
  doneIcon: { alignItems: 'center', marginBottom: 6 },
  doneText: { fontSize: 14.5, color: colors.text, lineHeight: 21, marginBottom: 8 },
});
