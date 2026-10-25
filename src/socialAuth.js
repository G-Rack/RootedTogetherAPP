// "Continue with Apple" and "Continue with Google".
//
// Apple (iPhone only): the native Apple sheet gives us an identity token, which
// Supabase turns into a normal session (signInWithIdToken). Android has no
// Apple button.
//
// Google (iPhone and Android): opens Google's sign-in in the system browser via
// Supabase, which comes back to the app through the rootedtogether:// link and
// is turned into a session here.
//
// Either way the result is an ordinary Supabase session. If that person has no
// Rooted Together profile yet (first time), App.js shows the short sign-up
// questions and then creates the profile (see complete-social-signup).
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_REDIRECT = 'rootedtogether://auth-callback';
const NONCE_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomNonce(length = 32) {
  const bytes = Crypto.getRandomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += NONCE_CHARS[bytes[i] % NONCE_CHARS.length];
  return out;
}

// Whether to show the Apple button at all.
export async function isAppleSignInAvailable() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

// Resolves to { ok: true } | { cancelled: true } | { error: 'message' }.
export async function signInWithApple() {
  try {
    const rawNonce = randomNonce();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      return { error: 'Apple didn’t return a sign-in token. Please try again.' };
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { error: error.message || 'Couldn’t sign in with Apple. Please try again.' };

    // Apple only shares the name the very first time, so keep it on the
    // account for the sign-up questions to pre-fill.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name) {
      try { await supabase.auth.updateUser({ data: { full_name: name } }); } catch (e) { /* optional */ }
    }
    return { ok: true };
  } catch (e) {
    if (e && e.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
    return { error: (e && e.message) || 'Couldn’t sign in with Apple. Please try again.' };
  }
}

// Account deletion: Apple requires revoking the Sign in with Apple link when
// someone deletes their account. That needs a fresh one-time code from Apple,
// so this re-shows the Apple sheet (no extra permissions asked). Resolves to
// the code string, or throws an Error with a friendly message.
export async function getAppleAuthorizationCode() {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    if (!credential.authorizationCode) throw new Error('Apple didn’t return a confirmation. Please try again.');
    return credential.authorizationCode;
  } catch (e) {
    if (e && e.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('To finish deleting your account, please confirm with Apple when asked.');
    }
    throw e;
  }
}

function paramsFromUrl(url) {
  const out = {};
  const raw = (url.split('#')[1] || url.split('?')[1] || '');
  raw.split('&').forEach((pair) => {
    if (!pair) return;
    const i = pair.indexOf('=');
    const k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
    const v = i < 0 ? '' : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    out[k] = v;
  });
  return out;
}

// Resolves to { ok: true } | { cancelled: true } | { error: 'message' }.
export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error || !data?.url) {
      return { error: (error && error.message) || 'Couldn’t start Google sign-in. Please try again.' };
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT);
    if (result.type !== 'success' || !result.url) return { cancelled: true };

    const p = paramsFromUrl(result.url);
    if (p.error_description || p.error) {
      return { error: p.error_description || 'Google sign-in didn’t complete. Please try again.' };
    }
    if (!p.access_token || !p.refresh_token) {
      return { error: 'Google sign-in didn’t complete. Please try again.' };
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: p.access_token,
      refresh_token: p.refresh_token,
    });
    if (sessionError) return { error: sessionError.message || 'Couldn’t finish signing in. Please try again.' };
    return { ok: true };
  } catch (e) {
    return { error: (e && e.message) || 'Couldn’t sign in with Google. Please try again.' };
  }
}
