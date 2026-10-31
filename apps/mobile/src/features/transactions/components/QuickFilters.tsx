import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { Category } from '@et/api-client';
import type { LedgerFilters } from '@et/domain';
import { space, touchTarget } from '../../../theme';
import { Chip } from '../../../ui';

export interface QuickFiltersProps {
  filters: LedgerFilters;
  onChange: (filters: LedgerFilters) => void;
  /** Category shortcuts after All / Debits / Credits (the user's most used). */
  categories: readonly Category[];
}

/** The chip row under search (locked Transactions mockup): All, Debits, Credits, then categories. */
export function QuickFilters({ filters, onChange, categories }: QuickFiltersProps) {
  const only = filters.categoryIds?.length === 1 ? filters.categoryIds[0] : undefined;
  const all = !filters.direction && !filters.categoryIds?.length;
  const direction = (d: 'debit' | 'credit') => onChange({ ...filters, direction: filters.direction === d ? undefined : d });
  const category = (id: string) => onChange({ ...filters, categoryIds: only === id ? undefined : [id] });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.strip}>
      <Chip label="All" selected={all} onPress={() => onChange({ ...filters, direction: undefined, categoryIds: undefined })} />
      <Chip label="Debits" selected={filters.direction === 'debit'} onPress={() => direction('debit')} />
      <Chip label="Credits" selected={filters.direction === 'credit'} onPress={() => direction('credit')} />
      {categories.map((c) => (
        <Chip key={c.id} label={c.name} selected={only === c.id} onPress={() => category(c.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { flexGrow: 0, marginHorizontal: -space.lg },
  row: { gap: space.xs, paddingHorizontal: space.lg, minHeight: touchTarget, alignItems: 'center' },
});
