import React from 'react';
import { EmptyState, Screen } from '../../../ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Home with no transactions yet (F7 empty state). Widgets arrive in Sprint 6. */
export function HomeScreen() {
  const now = new Date();
  return (
    <Screen eyebrow={greeting(now.getHours())} title={`Your ${MONTHS[now.getMonth()]}`} withTabBar>
      <EmptyState
        title="No transactions yet"
        message="Import a bank statement or add one by hand to see where your money goes."
        actions={[{ label: 'Import a statement' }, { label: 'Add manually' }]}
      />
    </Screen>
  );
}
