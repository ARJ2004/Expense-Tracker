import React from 'react';
import { accountName, useAccounts } from '../../accounts';
import { BottomSheet, Card, ListRow } from '../../../ui';

export interface AccountPickerProps {
  visible: boolean;
  value: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

/** Pick which account paid; "No account" is allowed for cash-like entries. */
export function AccountPicker({ visible, value, onSelect, onClose }: AccountPickerProps) {
  const accounts = useAccounts();
  const items = accounts.data ?? [];
  const choose = (id: string | null) => {
    onSelect(id);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Account">
      <Card padding="rows">
        {items.map((a) => (
          <ListRow key={a.id} variant="detail" label={accountName(a)} value={a.id === value ? 'Selected' : undefined} valueTone="accent" onPress={() => choose(a.id)} />
        ))}
        <ListRow variant="detail" label="No account" value={value === null ? 'Selected' : undefined} valueTone="accent" onPress={() => choose(null)} last />
      </Card>
    </BottomSheet>
  );
}
