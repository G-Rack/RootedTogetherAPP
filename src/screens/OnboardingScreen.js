import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, BackHandler, Linking,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import SelectModal from '../components/SelectModal';
import {
  Gradient, TopBar, Heading, PrimaryButton, ErrorNote, DARK,
} from '../components/DarkUI';
import { serif } from '../theme';
import { softHaptic } from '../haptics';
import { SUPPORT_OPTIONS } from '../flows';
import { WEB_BASE_URL } from '../config';
import { getPendingCode, subscribeToReferral } from '../referral';

// The new, short sign-up: an account screen, then a few tap-to-answer slides.
// Everything the old long form asked that isn't collected here lives in the
// Profile checklist ("Finish your profile") and Edit Profile.
//
// Nothing is created on the server until the last slide: the account step
// only checks the email/password locally, then everything is submitted
// together — same `submit-signup` function and field names as before, so
// quitting half-way never leaves a half-made account behind.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// role keys are the flow keys from flows.js ("priest" = Pastor).
const ROLES = [
  { key: 'seeker', icon: 'heart-outline', label: "I'm looking for support", sub: 'Find guidance, community and prayer' },
  { key: 'assistant', icon: 'people-outline', label: 'I want to serve alongside others', sub: 'Offer encouragement and care' },
  { key: 'mother', icon: 'star-outline', label: "I'm a Spiritual Mother", sub: 'Guide and mentor a family circle' },
  { key: 'priest', icon: 'book-outline', label: "I'm a Pastor or Priest", sub: 'Shepherd people and lead a family' },
  { key: 'influencer', icon: 'megaphone-outline', label: "I'm a creator or leader", sub: 'Share teaching, courses and community' },
  { key: 'church', icon: 'business-outline', label: 'I represent a church or ministry', sub: 'List your church and reach people' },
];

// Stored values stay exactly as before (so Edit Profile and the database are
// unchanged); only the label shown on the slide is friendlier.
const OPTION_LABELS = { Kids: 'Kids & Teens', Other: 'Something else' };
const OPTION_ICONS = {
  'Grief': 'cloud-outline',
  'Addiction & Recovery': 'sync-outline',
  'Family Estrangement': 'people-outline',
  'Marriage': 'heart-outline',
  'Parenting': 'person-outline',
  'Kids': 'happy-outline',
  'Isolation & Loneliness': 'moon-outline',
  'Anger': 'flash-outline',
  'Other': 'ellipsis-horizontal',
};

const GOALS = [
  { key: 'Lead a Spiritual Family', icon: 'people-outline', roles: ['mother', 'priest'] },
  { key: 'Sell courses & resources', icon: 'school-outline' },
  { key: 'Build a community', icon: 'globe-outline' },
  { key: 'Talk 1-on-1 with seekers', icon: 'chatbubble-outline' },
  { key: 'Share posts & teaching', icon: 'megaphone-outline' },
];

const STEP_TAILS = {
  seeker: ['needs', 'forwho', 'faith', 'about'],
  assistant: ['focus', 'about'],
  mother: ['goals', 'about'],
  priest: ['goals', 'about'],
  influencer: ['goals', 'about'],
  church: ['goals', 'about'],
};

function stepsFor(role) {
  if (!role) return ['account', 'role'];
  return ['account', 'role', ...STEP_TAILS[role]];
}

function buildDob(day, month, year) {
  const d = parseInt(day, 10);
  const y = parseInt(year, 10);
  const m = MONTHS.indexOf(month) + 1;
  if (!d || !m || !y || String(year).length !== 4) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  if (dt > new Date() || y < 1900) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Turns the slide answers into the exact field names submit-signup expects.
function buildFields(role, data, dob) {
  const fields = { Email: data.email.trim(), Password: data.password };
  // Optional: the code of the member who invited them (RT-00042). App.js
  // sends it as referredByCode, so it is never saved as a profile answer.
  if (data.referral.trim()) fields['Referral Code'] = data.referral.trim();
  const goalsNote = data.goals.length ? `Goals when signing up: ${data.goals.join(', ')}.` : null;

  if (role === 'church') {
    fields['Organisation Name'] = data.orgName.trim();
    fields['Contact Name'] = data.contactName.trim();
    if (goalsNote) fields['Anything Else'] = goalsNote;
    return fields;
  }

  fields.Name = data.name.trim();
  fields['Date of Birth'] = dob;
  if (role === 'seeker') {
    fields['Signing Up For'] = data.forWho;
    // The database requires a religion value; "Prefer not to say" and an
    // unanswered question are both stored as Other (editable in Edit Profile).
    fields.Religion = data.faith === 'Christian' ? 'Christian' : 'Other';
    if (data.needs.length) fields['What Kind of Support Are You Looking For'] = data.needs;
  } else if (role === 'assistant') {
    if (data.focus.length) fields['Spiritual Gifts & Areas of Focus'] = data.focus;
  } else if (goalsNote) {
    fields['Anything Else'] = goalsNote;
  }
  return fields;
}

export default function OnboardingScreen({ onSubmit, onLogin }) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState({
    email: '', password: '', referral: getPendingCode() || '', role: null,
    needs: [], focus: [], goals: [],
    forWho: 'Myself', faith: null,
    name: '', day: '', month: '', year: '',
    orgName: '', contactName: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const mounted = useRef(true);
  const advancing = useRef(false);

  useEffect(() => () => { mounted.current = false; }, []);

  // A referral link opened while sign-up is showing fills the code in.
  useEffect(() => subscribeToReferral((code) => {
    setData((d) => (d.referral ? d : { ...d, referral: code }));
  }), []);

  const steps = stepsFor(data.role);
  const stepKey = steps[Math.min(index, steps.length - 1)];
  const barTotal = steps.length - 1; // the account step has no bar
  const barStep = Math.max(0, index);

  function set(key, value) {
    setData((d) => ({ ...d, [key]: value }));
  }

  // Tapping an answer picks it and moves straight to the next slide (the
  // short pause lets the selection show). Back arrow returns to change it.
  function pick(apply) {
    if (advancing.current) return;
    advancing.current = true;
    softHaptic();
    setError(null);
    apply();
    setTimeout(() => {
      advancing.current = false;
      if (mounted.current) setIndex((i) => i + 1);
    }, 200);
  }

  function goBack() {
    if (index <= 0) return false;
    setError(null);
    setIndex((i) => i - 1);
    return true;
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      return goBack();
    });
    return () => sub.remove();
  }, [index, submitting]);

  async function finish() {
    setError(null);
    let dob = null;
    if (data.role === 'church') {
      if (!data.orgName.trim()) return setError('Please enter your church or ministry name.');
      if (!data.contactName.trim()) return setError('Please enter your name.');
    } else {
      if (data.name.trim().length < 2) return setError('Please enter your name.');
      dob = buildDob(data.day, data.month, data.year);
      if (!dob) return setError('Please enter a valid date of birth.');
    }
    setSubmitting(true);
    const res = await onSubmit(data.role, buildFields(data.role, data, dob));
    if (!mounted.current) return undefined;
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'Something went wrong. Please try again.');
      // A problem with the email or password lives on the first slide.
      if (/already has an account|valid email|password/i.test(res.error || '')) setIndex(0);
    }
    return undefined;
  }

  function next() {
    setError(null);
    if (stepKey === 'account') {
      if (!EMAIL_RE.test(data.email.trim())) return setError('Please enter a valid email address (e.g. name@example.com).');
      if (data.password.length < 8) return setError('Your password needs to be at least 8 characters.');
      if (data.referral.trim() && !/^RT-?\d{1,8}$/i.test(data.referral.trim())) {
        return setError('That referral code doesn’t look right. It should look like RT-00042.');
      }
      return setIndex(1);
    }
    if (stepKey === 'role') {
      if (!data.role) return setError('Please pick the option that fits you best.');
      return setIndex(2);
    }
    if (stepKey === 'about') return finish();
    return setIndex((i) => i + 1);
  }

  function skip() {
    setError(null);
    setIndex((i) => i + 1);
  }

  // ---------- slide bodies ----------

  function renderAccount() {
    return (
      <>
        <View style={styles.brandWrap}>
          <View style={styles.logo}>
            <Ionicons name="leaf-outline" size={34} color={DARK.gold} />
          </View>
          <Text style={styles.brand}>Rooted Together</Text>
          <Text style={styles.tagline}>A faith community that walks with you.</Text>
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={20} color={DARK.faint} />
          <TextInput
            style={styles.inputInner}
            value={data.email}
            onChangeText={(t) => set('email', t)}
            placeholder="Email address"
            placeholderTextColor={DARK.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            keyboardAppearance="dark"
            accessibilityLabel="Email"
          />
        </View>
        <View style={[styles.inputWrap, { marginTop: 10 }]}>
          <Ionicons name="lock-closed-outline" size={20} color={DARK.faint} />
          <TextInput
            style={styles.inputInner}
            value={data.password}
            onChangeText={(t) => set('password', t)}
            placeholder="Password (8+ characters)"
            placeholderTextColor={DARK.faint}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            // Same iOS autofill workaround as PasswordInput.js.
            textContentType="oneTimeCode"
            keyboardAppearance="dark"
            accessibilityLabel="Password"
          />
          <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={21} color={DARK.faint} />
          </TouchableOpacity>
        </View>

        {showRef || data.referral ? (
          <View style={[styles.inputWrap, { marginTop: 10 }]}>
            <Ionicons name="gift-outline" size={20} color={DARK.faint} />
            <TextInput
              style={styles.inputInner}
              value={data.referral}
              onChangeText={(t) => set('referral', t.toUpperCase())}
              placeholder="Referral code (e.g. RT-00042)"
              placeholderTextColor={DARK.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardAppearance="dark"
              accessibilityLabel="Referral code"
            />
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowRef(true)} style={styles.refToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.refToggleText}>Have a referral code?</Text>
          </TouchableOpacity>
        )}

        <View style={{ marginTop: 16 }}>
          <ErrorNote message={error} />
          <PrimaryButton label="Create account" variant="gold" onPress={next} />
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(`${WEB_BASE_URL}/terms`)}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.legalLink} onPress={() => Linking.openURL(`${WEB_BASE_URL}/privacy`)}>Privacy Policy</Text>.
        </Text>

        <View style={{ flex: 1, minHeight: 16 }} />
        <TouchableOpacity onPress={onLogin} style={styles.signInRow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.signInText}>Already have an account? <Text style={styles.signInLink}>Sign in</Text></Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderRole() {
    return (
      <>
        <Heading title="How will you use Rooted Together?" sub="Pick the one that fits best. This sets up your space." />
        <View style={{ gap: 9 }}>
          {ROLES.map((r) => {
            const on = data.role === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.roleRow, on && styles.optionOn]}
                onPress={() => pick(() => set('role', r.key))}
                activeOpacity={0.8}
              >
                <View style={styles.roleIcon}>
                  <Ionicons name={r.icon} size={21} color={DARK.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleLabel}>{r.label}</Text>
                  <Text style={styles.roleSub}>{r.sub}</Text>
                </View>
                {on ? <Ionicons name="checkmark" size={22} color={DARK.gold} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  function renderOptionGrid(listKey, title, sub) {
    return (
      <>
        <Heading title={title} sub={sub} />
        <View style={styles.grid}>
          {SUPPORT_OPTIONS.map((opt) => {
            const on = data[listKey].includes(opt);
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.cell, on && styles.optionOn]}
                onPress={() => pick(() => set(listKey, [opt]))}
                activeOpacity={0.8}
              >
                <Ionicons name={OPTION_ICONS[opt]} size={22} color={DARK.gold} />
                <Text style={styles.cellText}>{OPTION_LABELS[opt] || opt}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={DARK.gold} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  function renderGoals() {
    const options = GOALS.filter((g) => !g.roles || g.roles.includes(data.role));
    const canStartFamily = data.role === 'mother' || data.role === 'priest';
    return (
      <>
        <Heading title="What would you like to do first?" sub="Pick your main goal. You can add more later in your profile." />
        <View style={{ gap: 10 }}>
          {options.map((g) => {
            const on = data.goals.includes(g.key);
            return (
              <TouchableOpacity
                key={g.key}
                style={[styles.goalRow, on && styles.optionOn]}
                onPress={() => pick(() => set('goals', [g.key]))}
                activeOpacity={0.8}
              >
                <Ionicons name={g.icon} size={24} color={DARK.gold} />
                <Text style={styles.goalText}>{g.key}</Text>
                {on ? <Ionicons name="checkmark" size={22} color={DARK.gold} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.note}>
          <Ionicons name="star-outline" size={18} color={DARK.gold} style={{ marginTop: 1 }} />
          <Text style={styles.noteText}>
            Creator accounts are free. Premium is only needed to message people{canStartFamily ? ' or start a family' : ''}.
          </Text>
        </View>
      </>
    );
  }

  function renderForWho() {
    const card = (value, icon) => {
      const on = data.forWho === value;
      return (
        <TouchableOpacity
          key={value}
          style={[styles.whoCard, on && styles.optionOn]}
          onPress={() => pick(() => set('forWho', value))}
          activeOpacity={0.8}
        >
          <View style={styles.whoTop}>
            <Ionicons name={icon} size={28} color={DARK.gold} />
            {on ? <Ionicons name="checkmark" size={20} color={DARK.gold} /> : null}
          </View>
          <Text style={styles.whoText}>{value}</Text>
        </TouchableOpacity>
      );
    };
    return (
      <>
        <Heading title="Who is this journey for?" sub="So we can match you with the right guidance." />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {card('Myself', 'person-outline')}
          {card('My child', 'happy-outline')}
        </View>
        <Text style={styles.smallNote}>If it's for your child, you can add their age on your profile later.</Text>
      </>
    );
  }

  function renderFaith() {
    return (
      <>
        <Heading title="What's your faith background?" sub="This helps us match you with the right guidance." />
        <View style={{ gap: 10 }}>
          {['Christian', 'Other', 'Prefer not to say'].map((opt) => {
            const on = data.faith === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.goalRow, on && styles.optionOn]}
                onPress={() => pick(() => set('faith', opt))}
                activeOpacity={0.8}
              >
                <Text style={styles.goalText}>{opt}</Text>
                {on ? <Ionicons name="checkmark" size={22} color={DARK.gold} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  function renderAbout() {
    const isChurch = data.role === 'church';
    return (
      <>
        <Heading
          title={isChurch ? 'Last thing. Tell us about your church.' : 'Last thing. What should we call you?'}
          sub={isChurch ? 'Two details, then you are in.' : 'Just two details, then you are in.'}
        />

        {isChurch ? (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.fieldLabel}>Church or ministry name</Text>
              <TextInput
                style={styles.input}
                value={data.orgName}
                onChangeText={(t) => set('orgName', t)}
                placeholder="Name of your church or ministry"
                placeholderTextColor={DARK.faint}
                autoCapitalize="words"
                textContentType="none"
                keyboardAppearance="dark"
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Your name</Text>
              <TextInput
                style={styles.input}
                value={data.contactName}
                onChangeText={(t) => set('contactName', t)}
                placeholder="First and last name"
                placeholderTextColor={DARK.faint}
                autoCapitalize="words"
                textContentType="name"
                keyboardAppearance="dark"
              />
              <Text style={styles.privacyNote}>Kept private, never shown publicly.</Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.fieldLabel}>Your name</Text>
              <TextInput
                style={styles.input}
                value={data.name}
                onChangeText={(t) => set('name', t)}
                placeholder="First and last name"
                placeholderTextColor={DARK.faint}
                autoCapitalize="words"
                textContentType="name"
                keyboardAppearance="dark"
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Date of birth</Text>
              <View style={styles.dobRow}>
                <TextInput
                  style={[styles.input, styles.dobDay]}
                  value={data.day}
                  onChangeText={(t) => set('day', t.replace(/[^0-9]/g, ''))}
                  placeholder="DD"
                  placeholderTextColor={DARK.faint}
                  keyboardType="number-pad"
                  maxLength={2}
                  textContentType="none"
                  keyboardAppearance="dark"
                  accessibilityLabel="Day"
                />
                <TouchableOpacity style={[styles.input, styles.dobMonth]} onPress={() => setMonthOpen(true)} activeOpacity={0.8}>
                  <Text style={data.month ? styles.dobMonthText : styles.dobMonthPlaceholder} numberOfLines={1}>
                    {data.month || 'Month'}
                  </Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, styles.dobYear]}
                  value={data.year}
                  onChangeText={(t) => set('year', t.replace(/[^0-9]/g, ''))}
                  placeholder="YYYY"
                  placeholderTextColor={DARK.faint}
                  keyboardType="number-pad"
                  maxLength={4}
                  textContentType="none"
                  keyboardAppearance="dark"
                  accessibilityLabel="Year"
                />
              </View>
              <View style={styles.privacyRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color={DARK.faint} style={{ marginTop: 1 }} />
                <Text style={styles.privacyNote}>Kept private. We use it to keep the community safe and age-appropriate.</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ flex: 1, minHeight: 24 }} />
        <ErrorNote message={error} />
        <PrimaryButton label="Finish" onPress={next} busy={submitting} />

        <SelectModal
          visible={monthOpen}
          title="Month"
          options={MONTHS}
          value={data.month}
          onSelect={(m) => { set('month', m); setMonthOpen(false); }}
          onClose={() => setMonthOpen(false)}
        />
      </>
    );
  }

  let body;
  let skippable = false;
  if (stepKey === 'account') body = renderAccount();
  else if (stepKey === 'role') body = renderRole();
  else if (stepKey === 'needs') {
    skippable = true;
    body = renderOptionGrid('needs', 'What are you walking through?', "Pick the one that matters most right now. You can add more later in your profile.");
  } else if (stepKey === 'focus') {
    skippable = true;
    body = renderOptionGrid('focus', 'Where would you like to serve?', "Pick the one you feel most called to. You can add more later in your profile.");
  } else if (stepKey === 'goals') {
    skippable = true;
    body = renderGoals();
  } else if (stepKey === 'forwho') {
    body = renderForWho();
  } else if (stepKey === 'faith') {
    skippable = true;
    body = renderFaith();
  } else body = renderAbout();

  return (
    <View style={styles.root}>
      <Gradient />
      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        {stepKey !== 'account' ? (
          <TopBar step={barStep} total={barTotal} onBack={submitting ? undefined : goBack} onSkip={skippable ? skip : undefined} />
        ) : null}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, stepKey === 'account' && { paddingTop: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {body}
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

const pillBase = {
  backgroundColor: DARK.pill, borderWidth: 1, borderColor: DARK.pillBorder,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2A1A10' },
  content: { flex: 1, paddingHorizontal: 24 },
  scroll: { flexGrow: 1, paddingBottom: 12 },

  optionOn: { backgroundColor: DARK.pillOn, borderColor: DARK.text, borderWidth: 1.5 },

  // Account
  brandWrap: { alignItems: 'center', gap: 10, marginBottom: 30 },
  logo: {
    width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: 'rgba(251,246,239,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontFamily: serif, fontSize: 32, fontWeight: '700', color: DARK.text, marginTop: 6 },
  tagline: { fontSize: 15, lineHeight: 22, color: DARK.soft, textAlign: 'center' },
  appleBtn: {
    height: 54, borderRadius: 999, backgroundColor: DARK.text, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10,
  },
  appleText: { color: DARK.ink, fontSize: 16, fontWeight: '600' },
  googleBtn: {
    ...pillBase, borderColor: 'rgba(251,246,239,0.28)', height: 54, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleText: { color: DARK.text, fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(251,246,239,0.2)' },
  dividerText: { color: DARK.faint, fontSize: 13 },
  inputWrap: {
    ...pillBase, height: 54, borderRadius: 999, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  inputInner: { flex: 1, color: DARK.text, fontSize: 16, paddingVertical: 0 },
  legal: { marginTop: 14, textAlign: 'center', fontSize: 12, lineHeight: 17, color: DARK.faint, paddingHorizontal: 8 },
  legalLink: { color: DARK.text, textDecorationLine: 'underline' },
  signInRow: { alignItems: 'center', paddingVertical: 8 },
  refToggle: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 2 },
  refToggleText: { color: DARK.gold, fontSize: 14, fontWeight: '600' },
  signInText: { fontSize: 15, color: DARK.soft },
  signInLink: { color: DARK.text, fontWeight: '700', textDecorationLine: 'underline' },

  // Role
  roleRow: {
    ...pillBase, minHeight: 64, borderRadius: 22, paddingVertical: 10, paddingLeft: 12, paddingRight: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  roleIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(251,246,239,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  roleLabel: { color: DARK.text, fontSize: 16, lineHeight: 20, fontWeight: '600' },
  roleSub: { color: 'rgba(251,246,239,0.7)', fontSize: 12.5, lineHeight: 17, marginTop: 1 },

  // Needs / focus grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  cell: {
    ...pillBase, width: '48.5%', minHeight: 66, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  cellText: { flex: 1, color: DARK.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },

  // Creator goals
  goalRow: {
    ...pillBase, height: 58, borderRadius: 999, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  goalText: { flex: 1, color: DARK.text, fontSize: 16, fontWeight: '600' },
  note: {
    marginTop: 18, flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(232,196,138,0.12)', borderWidth: 1, borderColor: 'rgba(232,196,138,0.3)',
  },
  noteText: { flex: 1, color: 'rgba(251,246,239,0.9)', fontSize: 13, lineHeight: 19 },

  // For who
  whoCard: {
    ...pillBase, flex: 1, height: 120, borderRadius: 22, padding: 16, justifyContent: 'space-between',
  },
  whoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  whoText: { color: DARK.text, fontSize: 17, fontWeight: '600' },
  smallNote: { marginTop: 10, marginHorizontal: 4, color: DARK.faint, fontSize: 12.5, lineHeight: 17 },
  groupLabel: { marginTop: 28, marginBottom: 12, color: 'rgba(251,246,239,0.85)', fontSize: 15, fontWeight: '600' },
  chip: {
    ...pillBase, height: 48, borderRadius: 999, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  chipText: { color: DARK.text, fontSize: 15, fontWeight: '600' },

  // About
  fieldLabel: { color: 'rgba(251,246,239,0.85)', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    ...pillBase, height: 54, borderRadius: 999, paddingHorizontal: 20, color: DARK.text, fontSize: 16,
    justifyContent: 'center',
  },
  dobRow: { flexDirection: 'row', gap: 10 },
  dobDay: { flex: 1, textAlign: 'center', paddingHorizontal: 8 },
  dobMonth: { flex: 1.5, alignItems: 'center', paddingHorizontal: 8 },
  dobYear: { flex: 1.2, textAlign: 'center', paddingHorizontal: 8 },
  dobMonthText: { color: DARK.text, fontSize: 16 },
  dobMonthPlaceholder: { color: DARK.faint, fontSize: 16 },
  privacyRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 8 },
  privacyNote: { flex: 1, color: DARK.faint, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
});
