// Powers real accounts. Every sign-up now creates a Supabase Auth user
// (server-side, inside the submit-signup Edge Function) alongside its row
// in seekers / assistants / mothers / pastors / influencers. This client
// is what lets the app sign that person in and keep them signed in across
// app launches — the accounts foundation everything else (follows, chat,
// bookings, editing your own profile) will build on top of.
//
// `expo-sqlite/localStorage/install` is Expo's current recommended way to
// give supabase-js a persistent `localStorage` to store the session in on
// native — there's no window.localStorage in React Native by default, and
// this is the replacement for the older AsyncStorage-based pattern.
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
