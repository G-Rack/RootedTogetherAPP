// Carries a referral code (RT-00042) from "someone invited me" to the sign-up
// screen, so the invited person never has to type it.
//
// A code can reach the app three ways:
//   1. The invite page's "Open the app" button -> rootedtogether://join?ref=RT-00042
//      (app already installed).
//   2. Google Play's install referrer: the invite page's Play Store link carries
//      &referrer=RT-00042, and the app reads it on first launch (Android only).
//   3. Typed by hand in the sign-up's "Have a referral code?" box (iPhone, or
//      anyone who was sent just the code).
// Whichever arrives first is remembered on the phone until the sign-up
// succeeds, then cleared.
import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';

const PENDING_KEY = 'rt_pending_referral';
const REFERRER_CHECKED_KEY = 'rt_install_referrer_checked';
const CODE_IN_TEXT = /RT-?(\d{1,8})/i;

const listeners = new Set();

// "rt-42" / "RT00042" / "RT-00042" -> "RT-00042" (as typed, digits kept), or null.
export function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^RT-?(\d{1,8})$/i);
  return m ? `RT-${m[1]}` : null;
}

function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function getPendingCode() {
  try {
    return normalizeCode(store()?.getItem(PENDING_KEY) || '');
  } catch {
    return null;
  }
}

function savePendingCode(code) {
  try {
    store()?.setItem(PENDING_KEY, code);
  } catch {
    // Storage unavailable: the code still reaches the open sign-up via listeners.
  }
  listeners.forEach((cb) => cb(code));
}

export function clearPendingCode() {
  try {
    store()?.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

// Called with the code whenever a new one is picked up (e.g. a link opened while
// the sign-up screen is already showing). Returns an unsubscribe function.
export function subscribeToReferral(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// rootedtogether://join?ref=RT-00042 or https://rootedtogether.club/join?ref=RT-00042
export function codeFromUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/[?&]ref=([^&#]+)/i);
  if (!m) return null;
  let value = m[1];
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep the raw value
  }
  return normalizeCode(value);
}

async function captureFromInstallReferrer() {
  if (Platform.OS !== 'android') return;
  try {
    if (store()?.getItem(REFERRER_CHECKED_KEY)) return;
    store()?.setItem(REFERRER_CHECKED_KEY, '1');
    const referrer = await Application.getInstallReferrerAsync();
    const m = typeof referrer === 'string' ? referrer.match(CODE_IN_TEXT) : null;
    const code = m ? normalizeCode(`RT-${m[1]}`) : null;
    if (code && !getPendingCode()) savePendingCode(code);
  } catch {
    // No referrer available (Expo Go, sideloaded build, old Play Services): nothing to do.
  }
}

// Start listening once when the app opens. Returns a cleanup function.
export function startReferralCapture() {
  Linking.getInitialURL()
    .then((url) => {
      const code = codeFromUrl(url);
      if (code) savePendingCode(code);
    })
    .catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => {
    const code = codeFromUrl(url);
    if (code) savePendingCode(code);
  });
  captureFromInstallReferrer();
  return () => sub.remove();
}
