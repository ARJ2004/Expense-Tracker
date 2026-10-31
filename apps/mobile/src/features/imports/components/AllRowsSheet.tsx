import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { ImportRow } from '@et/api-client';
import { formatINR } from '@et/domain';
import { space } from '../../../theme';
import { BottomSheet, Tag, Toggle, type TagTone } from '../../../ui';
import { rowDay } from '../labels';

export interface AllRowsSheetProps {
  visible: boolean;
  rows: readonly ImportRow[];
  onToggle: (row: ImportRow, include: boolean) => void;
  onClose: () => void;
}

function rowTag(row: ImportRow): { label: string; tone: TagTone } | null {
  if (row.status === 'duplicate') return { label: 'Already in ledger', tone: 'neutral' };
  if (row.status === 'possible_duplicate') return { label: 'Possible duplicate', tone: 'warning' };
  if (row.balanceMismatch) return { label: "Balance doesn't add up", tone: 'warning' };
  return null;
}

/** "Review all rows": every row with an include switch. Duplicates start off; flagged rows are tagged. */
export function AllRowsSheet({ visible, rows, onToggle, onClose }: AllRowsSheetProps) {
  const renderItem = useCallback<ListRenderItem<ImportRow>>(
    ({ item }) => {
      const tag = rowTag(item);
      const amount = formatINR(item.direction === 'debit' ? -item.amountPaise : item.amountPaise, { signed: true });
      return (
        <View style={styles.row}>
          <Toggle
            label={item.merchantName ?? item.narration}
            hint={`${rowDay(item.occurredOn)} · ${item.direction === 'debit' ? 'Debit' : 'Credit'} · ${amount}`}
            value={item.action === 'import'}
            onValueChange={(include) => onToggle(item, include)}
          />
          {tag && (
            <View style={styles.tag}>
              <Tag label={tag.label} tone={tag.tone} />
            </View>
          )}
        </View>
      );
    },
    [onToggle],
  );
  return (
    <BottomSheet visible={visible} onClose={onClose} title="All rows" height="tall">
      <FlashList data={rows as ImportRow[]} renderItem={renderItem} keyExtractor={(r) => String(r.rowNo)} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.xs, gap: space.xxs },
  tag: { alignItems: 'flex-start' },
});
