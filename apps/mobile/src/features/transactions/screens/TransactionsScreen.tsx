import React from 'react';
import { EmptyState, IconButton, Screen } from '../../../ui';

/** Ledger placeholder; the list, search and filters arrive in Sprint 4 (F4). */
export function TransactionsScreen() {
  return (
    <Screen title="Transactions" headerAction={<IconButton icon="filter" accessibilityLabel="Filters" />} withTabBar>
      <EmptyState title="Nothing here yet" message="Transactions you add or import will appear here, grouped by day." />
    </Screen>
  );
}
