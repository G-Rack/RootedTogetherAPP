import React, { useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { likeHaptic, softHaptic } from '../haptics';

// Wraps a post's image / text so a quick double-tap likes it, Instagram
// style: a big icon pops over the content, the phone gives a haptic buzz, and
// `onDoubleTap` runs — but only if it isn't already liked (a double-tap never
// UN-likes; use the heart button for that). If it's already liked you still
// get the pop and a lighter tap so the gesture always feels acknowledged.
//
// Single taps pass through untouched (nothing happens), so this is safe to
// wrap around any non-interactive content.
const DOUBLE_TAP_MS = 300;

export default function DoubleTapLike({
  onDoubleTap, alreadyActive, icon = 'heart', iconColor = '#fff', iconSize = 96, style, children,
}) {
  const lastTap = useRef(0);
  const touch = useRef({ x: 0, y: 0, t: 0 });
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  function burst() {
    scale.stopAnimation();
    opacity.stopAnimation();
    scale.setValue(0.3);
    opacity.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      Animated.delay(220),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }

  function registerTap() {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      burst();
      if (alreadyActive) {
        softHaptic();
      } else {
        likeHaptic();
        if (onDoubleTap) onDoubleTap();
      }
    } else {
      lastTap.current = now;
    }
  }

  // Plain touch events rather than a Pressable: this view never claims the
  // gesture, so it can't get in the way of scrolling or of buttons nearby, and
  // it adds nothing to the layout. A "tap" is a short touch that barely moved
  // (a scroll or long-press isn't counted).
  function handleTouchStart(e) {
    const { pageX, pageY } = e.nativeEvent;
    touch.current = { x: pageX, y: pageY, t: Date.now() };
  }
  function handleTouchEnd(e) {
    const { pageX, pageY } = e.nativeEvent;
    const moved = Math.hypot(pageX - touch.current.x, pageY - touch.current.y);
    if (moved < 12 && Date.now() - touch.current.t < 300) registerTap();
  }

  return (
    <View style={style} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
      <View style={styles.overlay} pointerEvents="none">
        <Animated.View style={{ opacity, transform: [{ scale }] }}>
          <Ionicons name={icon} size={iconSize} color={iconColor} style={styles.iconShadow} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
});
