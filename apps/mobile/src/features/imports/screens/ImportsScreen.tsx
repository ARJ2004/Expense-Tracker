import React from 'react';
import { EmptyState, Screen } from '../../../ui';

/** Imports placeholder; statement upload arrives in Sprint 5 (F6). */
export function ImportsScreen() {
  return (
    <Screen title="Imports" withTabBar>
      <EmptyState title="No imports yet" message="Upload a CSV or Excel statement from your bank to bring in past transactions." />
    </Screen>
  );
}
