import React from 'react';
import { usePreferences, type Appearance } from '../../../lib';
import { BottomSheet, SegmentedControl, Text } from '../../../ui';

export const APPEARANCE_LABELS: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const OPTIONS = (['system', 'light', 'dark'] as const).map((value) => ({ value, label: APPEARANCE_LABELS[value] }));

export interface AppearanceSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** System / Light / Dark. Applies at once and is kept on this phone only. */
export function AppearanceSheet({ visible, onClose }: AppearanceSheetProps) {
  const appearance = usePreferences((s) => s.appearance);
  const setAppearance = usePreferences((s) => s.setAppearance);
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Appearance">
      <SegmentedControl accessibilityLabel="Appearance" options={OPTIONS} value={appearance} onChange={setAppearance} />
      <Text variant="secondary" tone="muted">
        System follows your phone's light or dark setting.
      </Text>
    </BottomSheet>
  );
}
