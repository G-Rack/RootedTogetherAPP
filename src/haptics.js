import * as Haptics from 'expo-haptics';

// Tiny wrappers so a missing/unsupported haptic engine (some Android phones,
// the web preview) never throws — a haptic is a nicety, never a failure.
function safe(fn) {
  try {
    const p = fn();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {
    // ignore
  }
}

// A "something good happened" buzz: a like / Helpful being added.
export function likeHaptic() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

// A light tap: double-tapping something that's already liked.
export function softHaptic() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
