import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StatusBar, StyleSheet, View } from 'react-native';
import NativeLaunchSplash from '../native/NativeLaunchSplash';
import { altusLight, radius, space } from '../theme';
import { Logo, Text } from '../ui';

/**
 * The native launch splash draws the launcher icon's mark at 288dp, fitted so its farthest corner
 * sits 88dp from the centre (scripts that render ic_launcher_foreground use the same rule). The
 * mark's corners in Logo's 0..120 viewBox are centred on (62, 61), not (60, 60).
 */
const SPLASH_RADIUS = 88;
const MARK_FAR = Math.hypot(54, 43);
const UNIT = SPLASH_RADIUS / MARK_FAR;
const LOGO_SIZE = 120 * UNIT;
const MARK_OFFSET = { x: -2 * UNIT, y: -1 * UNIT };

/** After the intro the mark settles smaller and higher, above the wordmark. */
const SETTLED_SCALE = 0.62;
const SETTLED_RISE = -56;
/** Where the settled mark's base line ends up, below the centre: the wordmark sits under it. */
const SETTLED_BASE = SETTLED_RISE + (104 - 61) * UNIT * SETTLED_SCALE;
/** Boot slower than this shows a progress bar, so a slow network doesn't look frozen. */
const SLOW_BOOT_MS = 1400;

/** Brand colours are fixed (not the user's theme) so they match the native splash exactly. */
const brand = altusLight;

export interface LaunchScreenProps {
  /** The session has booted; the screen plays its exit once its intro has finished. */
  ready: boolean;
  onDone: () => void;
}

/**
 * Takes over from the native splash on the same navy, with the mark in the same place, then
 * settles into the wordmark and fades out to the first screen.
 */
export function LaunchScreen({ ready, onDone }: LaunchScreenProps) {
  const intro = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [slow, setSlow] = useState(false);

  /**
   * Dismisses the native splash once this screen has been painted. onLayout fires before the frame
   * reaches the screen, so wait two more frames; hiding earlier shows a blank navy frame.
   */
  const onLayout = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        NativeLaunchSplash?.hide();
        setShown(true);
      }),
    );
  }, []);

  // The intro starts only once the native splash is gone, or it plays unseen behind it. Android
  // takes a few frames to remove its splash view after hide(), hence the delay.
  useEffect(() => {
    if (!shown) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        Animated.timing(intro, {
          toValue: 1,
          duration: reduce ? 0 : 640,
          delay: reduce ? 0 : 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => setIntroDone(true));
      });
    const timer = setTimeout(() => setSlow(true), SLOW_BOOT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shown, intro]);

  useEffect(() => {
    if (!slow || ready) return;
    const loop = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [slow, ready, slide]);

  useEffect(() => {
    if (!ready || !introDone) return;
    Animated.timing(exit, { toValue: 1, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [ready, introDone, exit, onDone]);

  const markStyle = {
    transform: [
      { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [0, SETTLED_RISE] }) },
      { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [1, SETTLED_SCALE] }) },
    ],
  };
  const wordStyle = {
    opacity: intro.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] }),
    transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  return (
    <Animated.View
      accessibilityLabel="Loading"
      pointerEvents={ready ? 'none' : 'auto'}
      onLayout={onLayout}
      style={[styles.root, { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.center, { transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}>
        <Animated.View style={[styles.mark, markStyle]}>
          <Logo size={LOGO_SIZE} cutout={brand.background} />
        </Animated.View>
        <Animated.View style={[styles.words, wordStyle]}>
          <Text variant="wordmark" style={{ color: brand.heroText }}>
            Altus
          </Text>
          <Text variant="secondary" style={{ color: brand.heroMuted }}>
            Every rupee, accounted for.
          </Text>
          <View style={[styles.track, slow && !ready ? styles.trackShown : null]}>
            <Animated.View style={[styles.bar, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-48, 120] }) }] }]} />
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: brand.hero },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: LOGO_SIZE, height: LOGO_SIZE, marginLeft: MARK_OFFSET.x * 2, marginTop: MARK_OFFSET.y * 2 },
  words: { position: 'absolute', top: '50%', marginTop: SETTLED_BASE + space.lg, alignItems: 'center', gap: space.xs },
  track: { width: 120, height: 3, borderRadius: radius.pill, marginTop: space.lg, overflow: 'hidden', opacity: 0, backgroundColor: brand.heroTrack },
  trackShown: { opacity: 1 },
  bar: { width: 48, height: 3, borderRadius: radius.pill, backgroundColor: brand.highlight },
});
