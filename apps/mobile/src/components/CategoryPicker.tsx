import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { Category } from '@et/api-client';
import { BottomSheet, ChipGroup } from '../ui';
import { CategoryIcon } from './CategoryIcon';

export interface CategoryPickerProps {
  visible: boolean;
  categories: readonly Category[];
  value: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Every category as icon chips in a sheet. Used by the Add sheet ("More") and Detail ("Change category"). */
export function CategoryPicker({ visible, categories, value, onSelect, onClose }: CategoryPickerProps) {
  const options = categories.map((c) => ({
    value: c.id,
    label: c.name,
    renderIcon: (tint: string) => <CategoryIcon icon={c.icon} tint={tint} />,
  }));
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Choose a category">
      <ScrollView style={styles.list}>
        <ChipGroup accessibilityLabel="Categories" options={options} value={value} onChange={onSelect} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 420 },
});
