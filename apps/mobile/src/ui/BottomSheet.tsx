import React, { type PropsWithChildren, useEffect, useMemo, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** "tall" fills the screen from 64 px below the top (Add sheet mockup); "auto" sizes to content (pickers). */
  height?: 'tall' | 'auto';
}

/** A pull this far down, or a quick flick, closes the sheet; anything less springs back. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.8;

/**
 * Modal sheet from the bottom: scrim, grabber, title and a close button. Tapping the scrim or
 * dragging the grabber and title down closes it. The drag is on the header only, so it never
 * fights a scrolling body.
 */
export function BottomSheet({ visible, onClose, title, height = 'auto', children }: PropsWithChildren<BottomSheetProps>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dragY = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Claim the touch as it starts: on Android the header is never offered the moves otherwise.
        // The close button is asked first (innermost wins), so its taps still work.
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
            Animated.timing(dragY, { toValue: sheetHeight.current || 800, duration: 180, useNativeDriver: true }).start(() =>
              closeRef.current(),
            );
          } else {
            Animated.spring(dragY, { toValue: 0, bounciness: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, bounciness: 0, useNativeDriver: true }).start(),
      }),
    [dragY],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => (sheetHeight.current = e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            height === 'tall' && { top: Math.max(64, insets.top + space.xs) },
            { backgroundColor: colors.surface, paddingBottom: space.xl + insets.bottom, transform: [{ translateY: dragY }] },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handle}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <View style={styles.header}>
              <Text variant="heading" accessibilityRole="header">
                {title}
              </Text>
              <IconButton icon="close" variant="filled" accessibilityLabel="Close" onPress={onClose} />
            </View>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    gap: 14,
  },
  // Pads the grab area up to the sheet's top edge, so the drag starts anywhere above the title.
  handle: { gap: 14, marginTop: -space.sm, paddingTop: space.sm },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
