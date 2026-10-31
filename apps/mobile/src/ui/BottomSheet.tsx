import React, { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
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

/** Modal sheet from the bottom: scrim, grabber, title and a close button. Tapping the scrim closes it. */
export function BottomSheet({ visible, onClose, title, height = 'auto', children }: PropsWithChildren<BottomSheetProps>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            height === 'tall' && { top: Math.max(64, insets.top + space.xs) },
            { backgroundColor: colors.surface, paddingBottom: space.xl + insets.bottom },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            <IconButton icon="close" variant="filled" accessibilityLabel="Close" onPress={onClose} />
          </View>
          {children}
        </View>
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
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.pill },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
