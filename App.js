import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors, serif } from './src/theme';
import { FLOWS, THANK_YOU } from './src/flows';
import { SUBMIT_ENDPOINT, SUPABASE_ANON_KEY } from './src/config';
import { supabase } from './src/supabaseClient';
import RoleSelectScreen from './src/screens/RoleSelectScreen';
import StepScreen from './src/screens/StepScreen';
import SignupDecisionScreen from './src/screens/SignupDecisionScreen';
import ReferralThankYouScreen from './src/screens/ReferralThankYouScreen';
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeTabs from './src/screens/HomeTabs';

export default function App() {
  // undefined = still checking for an existing session on launch;
  // null = signed out; an object = signed in.
  const [session, setSession] = useState(undefined);
  const [authScreen, setAuthScreen] = useState('signup'); // 'signup' | 'login' | 'forgot', only relevant while signed out

  const [role, setRole] = useState(null); // null = role select screen
  const [formData, setFormData] = useState({});
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  // Shown right after the required first step — lets someone choose
  // between filling in the optional "more about you" step(s) now or
  // jumping straight into the app (see SignupDecisionScreen / handleNext).
  const [showDecision, setShowDecision] = useState(false);
  const [pendingNextIndex, setPendingNextIndex] = useState(null);

  // Accounts foundation: check for an existing session once on launch, and
  // keep listening afterwards — this is what picks up both a fresh login
  // from LoginScreen and the automatic sign-in right after a new sign-up,
  // without either screen having to manually flip any state itself.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription?.subscription?.unsubscribe();
  }, []);

  // Merges in the *unsaved* current-step answers (not just committed
  // formData) so a gating question — like Religion, asked and answered
  // within the very step that decides whether more steps follow — updates
  // the Continue/Submit label and progress bar the instant it's picked,
  // rather than only after advancing.
  const visibleSteps = useMemo(() => {
    if (!role) return [];
    const preview = { ...formData, ...draft };
    return FLOWS[role].steps.filter((s) => !s.condition || s.condition(preview));
  }, [role, formData, draft]);

  const step = visibleSteps[stepIndex];
  const totalForProgress = visibleSteps.length + 1;
  const progress = role ? Math.round(((stepIndex + 1) / totalForProgress) * 100) : 0;

  function startFlow(r) {
    setRole(r);
    setFormData({});
    setDraft({});
    setStepIndex(0);
    setError(null);
    setSubmitted(false);
    setReferralCode(null);
    setShowDecision(false);
    setPendingNextIndex(null);
  }

  function resetToStart() {
    setRole(null);
    setFormData({});
    setDraft({});
    setStepIndex(0);
    setError(null);
    setSubmitted(false);
    setReferralCode(null);
    setShowDecision(false);
    setPendingNextIndex(null);
  }

  function handleChange(name, value) {
    setDraft((d) => ({ ...d, [name]: value }));
  }

  // Deliberately permissive — just "something@something.something" with no
  // whitespace. This exists to catch an incomplete/malformed address (like
  // "name@test" with no real domain) before it ever reaches the backend:
  // Supabase Auth's own, stricter format check rejects those when creating
  // the login, which used to surface as a confusing generic "couldn't
  // create your account" error instead of a clear "check your email" one.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateStep() {
    for (const f of step.fields) {
      if (f.condition && !f.condition(draft)) continue; // not shown right now — nothing to validate
      if (!f.required) continue;
      const v = draft[f.name];
      const isMultiValued = f.type === 'multiselect' || f.type === 'pillmultiselect';
      if (isMultiValued ? !(Array.isArray(v) && v.length) : !v) {
        setError(`Please fill in "${f.label}" before continuing.`);
        return false;
      }
    }
    if (step.fields.some((f) => f.name === 'Email') && !EMAIL_RE.test((draft.Email || '').trim())) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return false;
    }
    // Every role's first step now includes creating a password — validate
    // it here rather than in FieldControl, which stays a dumb renderer.
    if (step.fields.some((f) => f.name === 'Password')) {
      if ((draft.Password || '').length < 8) {
        setError('Your password needs to be at least 8 characters.');
        return false;
      }
      if (draft.Password !== draft['Confirm Password']) {
        setError('Those passwords don’t match.');
        return false;
      }
    }
    return true;
  }

  function handleBack() {
    setError(null);
    if (stepIndex === 0) {
      resetToStart();
      return;
    }
    setStepIndex((i) => i - 1);
  }

  async function handleNext() {
    setError(null);
    if (!validateStep()) return;

    const nextFormData = { ...formData, ...draft };
    // Drop any leftover value for a field that's no longer relevant given
    // this step's other answers (e.g. "Child Age" after switching back to
    // "Myself") so a hidden field never gets submitted.
    for (const f of step.fields) {
      if (f.condition && !f.condition(nextFormData)) delete nextFormData[f.name];
    }
    setFormData(nextFormData);

    const nextVisibleSteps = FLOWS[role].steps.filter((s) => !s.condition || s.condition(nextFormData));
    const currentId = step.id;
    const idxInNew = nextVisibleSteps.findIndex((s) => s.id === currentId);
    const nextIndex = idxInNew >= 0 ? idxInNew + 1 : stepIndex + 1;

    // Right after the required first step (name/email/password/DOB, plus
    // whatever else that role's core step asks), offer the choice to keep
    // going or jump into the app now — but only when there's actually more
    // to fill in. A role whose only optional step got conditioned away
    // (e.g. a Seeker who answered "Other" to Religion, which hides
    // seeker-faith entirely) has nothing left to skip, so it submits
    // straight through exactly like before.
    if (stepIndex === 0 && nextIndex < nextVisibleSteps.length) {
      setDraft(nextFormData);
      setPendingNextIndex(nextIndex);
      setShowDecision(true);
      return;
    }

    if (nextIndex >= nextVisibleSteps.length) {
      await submit(nextFormData);
    } else {
      setStepIndex(nextIndex);
      setDraft(nextFormData); // repopulate any previously entered values
    }
  }

  // Back from the decision screen just re-shows the core step — stepIndex
  // is still 0, and `draft` already holds its answers (set above in
  // handleNext), so there's nothing else to restore.
  function handleDecisionBack() {
    setShowDecision(false);
    setPendingNextIndex(null);
  }

  function handleDecisionContinue() {
    setShowDecision(false);
    setStepIndex(pendingNextIndex);
    setPendingNextIndex(null);
    // `draft` already holds formData from handleNext above, repopulating
    // the next step the same way the normal advance path does.
  }

  // A real skip, not a soft nudge: submits the account with just what's
  // been entered so far (the core step) and drops straight into the
  // signed-in app rather than the usual thank-you/referral-code screen —
  // everything the optional step(s) would have asked can be filled in
  // later from Profile -> Settings -> Edit Profile.
  async function handleDecisionSkip() {
    setPendingNextIndex(null);
    await submit(formData, { skipThankYou: true });
  }

  async function submit(finalFormData, opts = {}) {
    setSubmitting(true);
    setError(null);

    const fields = { ...finalFormData };

    // The profile picture can't travel inside `fields` as a plain JSON
    // value the way text/select answers can — Airtable's attachment field
    // needs a separate upload step. Pull it out into its own payload key;
    // the backend attaches it to the record after creating it.
    const picture = fields['Profile Picture'];
    delete fields['Profile Picture'];
    const profilePicture = picture
      ? { filename: picture.fileName, contentType: picture.mimeType, base64: picture.base64 }
      : null;

    // Same treatment for the password: it creates a real login server-side,
    // it isn't a column on the role table, so it travels as its own
    // payload key. "Confirm Password" only ever existed to catch a typo on
    // this device — it never leaves it.
    const password = fields['Password'];
    delete fields['Password'];
    delete fields['Confirm Password'];

    // Same treatment as the profile picture: the certification document
    // (only present for mother/priest/influencer, and only when "Has
    // Relevant Credentials" was answered "Yes, I do") can't travel as a
    // plain JSON field value, so it goes out as its own payload key. The
    // backend uploads it to the private certification-documents bucket —
    // never shown publicly, used only for internal vetting.
    const certification = fields['Certification Upload'];
    delete fields['Certification Upload'];
    const certificationFile = certification
      ? { filename: certification.fileName, contentType: certification.mimeType, base64: certification.base64 }
      : null;

    // Demo builds (EXPO_PUBLIC_DEMO_MODE=true at build time, e.g. for a
    // click-through preview with no live backend) simulate a successful
    // save instead of calling the real endpoint. The shipped app never
    // sets this, so production builds always hit the real function.
    if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 500));
      setReferralCode('RT-00001');
      setSubmitting(false);
      setSubmitted(true);
      return;
    }

    try {
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ role, fields, profilePicture, certificationFile, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong saving your sign-up.');
      }
      if (data.referralCode) setReferralCode(data.referralCode);

      // The account now exists on the backend — sign straight in with the
      // same credentials so there's already a real session by the time
      // "Explore the app" is tapped on the thank-you screen. A failure
      // here doesn't undo the sign-up itself; it just means falling back
      // to the "Already have an account? Log in" link.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: finalFormData.Email,
        password,
      });
      if (signInError) {
        console.warn('Post-signup sign-in failed:', signInError.message);
      }

      // Normally this flips to the thank-you / referral-code screen. When
      // skipping ahead (see handleDecisionSkip), the sign-in above just
      // started a real session, so the top-level `if (session)` check at
      // the bottom of this component takes over on its own as soon as
      // that lands — no need to show anything else first. The one
      // exception is if that sign-in itself failed: with no session to
      // fall back on, still show the thank-you screen so the sign-up
      // isn't a dead end (its "Explore the app" button routes to login).
      if (!(opts.skipThankYou && !signInError)) {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const thankYouKey = role === 'seeker'
    ? (formData.Religion === 'Christian' ? 'seeker_christian' : 'seeker_other')
    : role;

  async function handleLogOut() {
    await supabase.auth.signOut();
    resetToStart();
    setAuthScreen('signup');
  }

  // Once there's a real session, the app switches to a fixed-height tab
  // layout instead of the scrolling sign-up panel below — HomeTabs' own
  // screens (like the Directory's FlatList) need a bounded height to
  // scroll correctly, which they can't get nested inside a ScrollView.
  if (session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.loggedInWrap}>
          <Text style={styles.brand}>Rooted Together</Text>
          <View style={styles.loggedInPanel}>
            <HomeTabs session={session} onLogOut={handleLogOut} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>Rooted Together</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.panel}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {session === undefined && (
              <Text style={styles.loadingText}>Loading…</Text>
            )}

            {session === null && authScreen === 'login' && (
              <LoginScreen
                onBack={() => setAuthScreen('signup')}
                onLoggedIn={() => {}}
                onForgotPassword={() => setAuthScreen('forgot')}
              />
            )}

            {session === null && authScreen === 'forgot' && (
              <ForgotPasswordScreen onBack={() => setAuthScreen('login')} />
            )}

            {session === null && authScreen === 'signup' && !role && (
              <RoleSelectScreen onSelect={startFlow} onLoginPress={() => setAuthScreen('login')} />
            )}

            {session === null && authScreen === 'signup' && role && !submitted && !showDecision && step && (
              <StepScreen
                step={step}
                draft={draft}
                onChange={handleChange}
                onBack={handleBack}
                onNext={handleNext}
                isFirstStep={stepIndex === 0}
                isLastStep={stepIndex === visibleSteps.length - 1}
                submitting={submitting}
              />
            )}

            {session === null && authScreen === 'signup' && role && !submitted && showDecision && (
              <SignupDecisionScreen
                onBack={handleDecisionBack}
                onContinue={handleDecisionContinue}
                onSkip={handleDecisionSkip}
                submitting={submitting}
              />
            )}

            {session === null && authScreen === 'signup' && role && submitted && (
              <ReferralThankYouScreen
                thankYou={THANK_YOU[thankYouKey]}
                referralCode={referralCode}
                onExplore={resetToStart}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 60 },
  loggedInWrap: { flex: 1, padding: 20, paddingTop: 24 },
  loggedInPanel: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 14,
    padding: 24,
    marginTop: 4,
  },
  brand: { fontFamily: serif, fontSize: 20, fontWeight: '700', color: colors.brown, textAlign: 'center', marginBottom: 20 },
  progressTrack: { height: 6, backgroundColor: colors.creamDark, borderRadius: 999, overflow: 'hidden', marginBottom: 24 },
  progressFill: { height: '100%', backgroundColor: colors.brown, borderRadius: 999 },
  panel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 14,
    padding: 24,
  },
  loadingText: { textAlign: 'center', fontSize: 14.5, color: colors.textSoft, paddingVertical: 20 },
  errorBox: {
    backgroundColor: colors.errorBg, borderWidth: 1, borderColor: colors.errorBorder,
    borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: colors.errorText, fontSize: 13.5 },
});
