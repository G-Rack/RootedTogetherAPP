import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import KeyboardAwareScrollView from './src/components/KeyboardAwareScrollView';
import { SafeAreaProvider, SafeAreaView as SafeAreaInsetView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors, serif } from './src/theme';
import { SUBMIT_ENDPOINT, SUPABASE_ANON_KEY } from './src/config';
import { supabase } from './src/supabaseClient';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeTabs from './src/screens/HomeTabs';
import { configureNotifications, unregisterPushNotifications } from './src/notifications';

// Show notifications as a banner even while the app is open (no-op in Expo Go).
configureNotifications();

export default function App() {
  // undefined = still checking for an existing session on launch;
  // null = signed out; an object = signed in.
  const [session, setSession] = useState(undefined);
  const [authScreen, setAuthScreen] = useState('signup'); // 'signup' | 'login' | 'forgot', only relevant while signed out
  // Set right after a successful sign-up so the welcome screen shows before
  // the app itself (see submitSignup / the render below).
  const [welcome, setWelcome] = useState(false);
  // 'checklist' = open the Profile checklist as soon as the app opens.
  const [profileIntent, setProfileIntent] = useState(null);

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

  // Called by the sign-up slides with the role and the answers (field names
  // match the submit-signup Edge Function's FIELD_MAP). Resolves to
  // { ok: true } or { ok: false, error } — the slides show the error.
  async function submitSignup(role, rawFields) {
    const fields = { ...rawFields };

    // The password creates a real login server-side — it isn't a column on
    // the role table, so it travels as its own payload key.
    const password = fields.Password;
    delete fields.Password;

    // A referral code (RT-00042) entered at sign-up. submit-signup resolves it
    // to the member who invited this person; an unknown code is simply ignored.
    const referredByCode = fields['Referral Code'];
    delete fields['Referral Code'];

    // Demo builds (EXPO_PUBLIC_DEMO_MODE=true at build time, e.g. for a
    // click-through preview with no live backend) simulate a successful
    // save instead of calling the real endpoint. The shipped app never
    // sets this, so production builds always hit the real function.
    if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 500));
      setWelcome(true);
      return { ok: true };
    }

    try {
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        // source: 'app' tells the server this is a native-app sign-up: creator
        // accounts are free here (no $49 website payment needed) and buy
        // Premium in the app to message, like Seekers and Assistants.
        body: JSON.stringify({ role, fields, profilePicture: null, certificationFile: null, password, source: 'app', referredByCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data.error || 'Something went wrong saving your sign-up.' };
      }

      // The account exists now. Show the welcome screen first (set BEFORE
      // signing in, so the app doesn't flash up behind it), then sign in
      // with the same credentials so there's already a real session by the
      // time "Start exploring" is tapped.
      setWelcome(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: fields.Email,
        password,
      });
      if (signInError) {
        // The sign-up itself worked — just send them to log in.
        console.warn('Post-signup sign-in failed:', signInError.message);
        setWelcome(false);
        setAuthScreen('login');
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || 'Something went wrong. Please try again.' };
    }
  }

  async function handleLogOut() {
    // Stop this phone getting the account's notifications — must happen
    // while still signed in.
    await unregisterPushNotifications();
    await supabase.auth.signOut();
    setWelcome(false);
    setProfileIntent(null);
    setAuthScreen('signup');
  }

  // Just signed up: welcome screen (dark, matches the sign-up slides).
  if (welcome) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <WelcomeScreen
          onStart={() => setWelcome(false)}
          onFinishProfile={() => {
            setProfileIntent('checklist');
            setWelcome(false);
          }}
        />
      </SafeAreaProvider>
    );
  }

  // Once there's a real session, the app switches to a fixed-height tab
  // layout instead of the scrolling sign-up panel below — HomeTabs' own
  // screens (like the Directory's FlatList) need a bounded height to
  // scroll correctly, which they can't get nested inside a ScrollView.
  if (session) {
    return (
      <SafeAreaProvider>
        <SafeAreaInsetView style={styles.safeLoggedIn} edges={['top', 'left', 'right']}>
          <StatusBar style="dark" />
          <View style={styles.loggedInWrap}>
            <HomeTabs session={session} onLogOut={handleLogOut} initialProfileIntent={profileIntent} />
          </View>
        </SafeAreaInsetView>
      </SafeAreaProvider>
    );
  }

  // Signed out, creating an account: the new dark slide-style sign-up.
  if (session === null && authScreen === 'signup') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OnboardingScreen onSubmit={submitSignup} onLogin={() => setAuthScreen('login')} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaInsetView style={styles.safe}>
      <StatusBar style="dark" />
      {/* Keeps the field being typed in visible above the keyboard by
          scrolling just enough, rather than pushing the whole form up. */}
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.brand}>Rooted Together</Text>

          <View style={styles.panel}>
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
          </View>
      </KeyboardAwareScrollView>
    </SafeAreaInsetView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 60 },
  // Signed-in app fills the whole screen (no card frame or brand title).
  // Top inset comes from SafeAreaInsetView; the bottom inset is applied to
  // the tab bar in HomeTabs so it clears Android's navigation bar.
  // Horizontal padding stays 24 because several screens use
  // marginHorizontal: -24 to run sections edge to edge.
  safeLoggedIn: { flex: 1, backgroundColor: colors.white },
  loggedInWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  brand: { fontFamily: serif, fontSize: 20, fontWeight: '700', color: colors.brown, textAlign: 'center', marginBottom: 20 },
  panel: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107,66,38,0.1)',
    borderRadius: 14,
    padding: 24,
  },
  loadingText: { textAlign: 'center', fontSize: 14.5, color: colors.textSoft, paddingVertical: 20 },
});
