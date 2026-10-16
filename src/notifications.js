import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from './supabaseClient';

// Push notifications for NEW MESSAGES and NEW FOLLOWERS.
//
// How it fits together:
//   * On sign-in the app asks permission, gets an Expo push token and saves
//     it against the signed-in account (register_push_token).
//   * When someone sends a message / follows, the app calls the `send-push`
//     edge function right after the row is created; the function works out
//     who to notify (skipping blocked pairs) and sends via Expo's push service.
//   * Tapping a notification switches to the right tab (see HomeTabs).
//
// Remote push does NOT work inside Expo Go on Android (Expo removed it in
// SDK 53), so everything here quietly does nothing in Expo Go and on web —
// it only runs in a real build (preview / production). expo-notifications is
// loaded lazily for the same reason: merely importing it in Expo Go logs an
// error.
const isExpoGo = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

let Notifications = null;
function getNotifications() {
  if (isExpoGo || Platform.OS === 'web') return null;
  if (Notifications) return Notifications;
  try {
    // eslint-disable-next-line global-require
    Notifications = require('expo-notifications');
  } catch (e) {
    Notifications = null;
  }
  return Notifications;
}

let registeredToken = null;

// Call once at app start: shows notifications as a banner even while the app
// is open (otherwise a message arriving while you're in the app is silent).
export function configureNotifications() {
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    // ignore
  }
}

// Asks permission (first time only), gets this phone's Expo push token and
// saves it for the signed-in account. Safe to call on every launch/sign-in.
export async function registerForPushNotifications() {
  const N = getNotifications();
  if (!N || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Messages & followers',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B4226',
      });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await N.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) return null;
    registeredToken = token;
    return token;
  } catch (e) {
    // No Firebase config in this build, offline, etc. — notifications just
    // stay off; nothing else in the app depends on them.
    return null;
  }
}

// Call while still signed in (before signOut) so this phone stops getting
// the previous account's notifications.
export async function unregisterPushNotifications() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  try {
    await supabase.rpc('unregister_push_token', { p_token: token });
  } catch (e) {
    // ignore
  }
}

// Calls `handler(data)` when a notification is tapped — including the one
// that launched the app from a closed state. Returns an unsubscribe function.
export function listenForNotificationTaps(handler) {
  const N = getNotifications();
  if (!N) return () => {};
  let removed = false;
  try {
    N.getLastNotificationResponseAsync().then((resp) => {
      const data = resp?.notification?.request?.content?.data;
      if (!removed && data && resp?.actionIdentifier === N.DEFAULT_ACTION_IDENTIFIER) handler(data);
    }).catch(() => {});
    const sub = N.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data;
      if (data) handler(data);
    });
    return () => {
      removed = true;
      sub.remove();
    };
  } catch (e) {
    return () => {};
  }
}

// Fire-and-forget: tells the server to push about something that just
// happened. Never throws and never blocks the caller — a failed push must
// not make a sent message look failed.
//   notifyPush({ kind: 'message', messageId })
//   notifyPush({ kind: 'family_message', messageId })
//   notifyPush({ kind: 'real_family_message', messageId })
//   notifyPush({ kind: 'follow', followeeAuthId })
export function notifyPush(payload) {
  try {
    supabase.functions.invoke('send-push', { body: payload }).catch(() => {});
  } catch (e) {
    // ignore
  }
}
