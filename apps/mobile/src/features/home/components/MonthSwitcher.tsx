import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space, touchTarget } from '../../../theme';
import { IconButton } from '../../../ui';

export interface MonthSwitcherProps {
  /** Shown in the labels, e.g. "September". */
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  /** Omit on the current month: there is no future to show. */
  onNext?: () => void;
}

/** Previous / next month arrows beside the Home title. */
export function MonthSwitcher({ previousLabel, nextLabel, onPrevious, onNext }: MonthSwitcherProps) {
  return (
    <View style={styles.row}>
      <IconButton icon="back" accessibilityLabel={`Show ${previousLabel}`} onPress={onPrevious} />
      {onNext ? <IconButton icon="chevron" accessibilityLabel={`Show ${nextLabel}`} onPress={onNext} /> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  spacer: { width: touchTarget },
});
