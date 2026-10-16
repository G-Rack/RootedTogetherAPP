import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Keyboard, TextInput, Platform } from 'react-native';

// A ScrollView that keeps the field you're typing in visible above the
// keyboard — the page itself stays put and only scrolls as far as needed,
// instead of the whole form being shoved upward.
//
// How: while the keyboard is open, extra space the height of the keyboard
// is added below the content (so the last fields can scroll into view),
// and whenever a field gains focus it's measured on screen and, if the
// keyboard would cover it, the list scrolls smoothly just enough to sit it
// a comfortable gap above the keyboard.
const GAP_ABOVE_KEYBOARD = 28;

export default function KeyboardAwareScrollView({ children, contentContainerStyle, ...rest }) {
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef(null);
  const lastFocused = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  function ensureFocusedVisible() {
    const input = TextInput.State.currentlyFocusedInput?.();
    if (!input || keyboardTop.current == null || !input.measureInWindow) return;
    input.measureInWindow((x, y, w, h) => {
      const limit = keyboardTop.current - GAP_ABOVE_KEYBOARD;
      const bottom = y + h;
      if (bottom > limit) {
        scrollRef.current?.scrollTo({ y: scrollY.current + (bottom - limit), animated: true });
      } else if (y < 80) {
        scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - (80 - y)), animated: true });
      }
    });
  }

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      // Let the extra bottom space lay out first, then scroll.
      setTimeout(ensureFocusedVisible, 60);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardTop.current = null;
      lastFocused.current = null;
      setKeyboardHeight(0);
    });
    // Moving to the next field while the keyboard stays open fires no
    // keyboard event, so watch for the focused field changing.
    const timer = setInterval(() => {
      if (keyboardTop.current == null) return;
      const input = TextInput.State.currentlyFocusedInput?.();
      if (input && input !== lastFocused.current) {
        lastFocused.current = input;
        ensureFocusedVisible();
      }
    }, 200);
    return () => {
      show.remove();
      hide.remove();
      clearInterval(timer);
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[contentContainerStyle, keyboardHeight ? { paddingBottom: keyboardHeight + 40 } : null]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
