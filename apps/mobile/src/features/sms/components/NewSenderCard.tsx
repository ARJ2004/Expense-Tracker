import React from 'react';
import { errorMessage } from '../../../lib';
import { Button, Card, Text } from '../../../ui';
import { useApproveSender } from '../hooks';
import { heldLabel } from '../labels';
import { useSmsCapture, type HeldTxn } from '../store';

/**
 * A sender Altus doesn't know yet ("SVCBNK"), with what its SMS would add. Nothing from it reaches
 * the ledger until the person says it is their bank, so a fake "₹5,000 credited" never does.
 */
export function NewSenderCard({ code, held }: { code: string; held: readonly HeldTxn[] }) {
  const approve = useApproveSender();
  const block = useSmsCapture((s) => s.block);
  return (
    <Card>
      <Text variant="heading">{code}</Text>
      <Text variant="secondary" tone="muted">
        {heldLabel(held)}. Is this your bank?
      </Text>
      {approve.isError && (
        <Text variant="secondary" tone="spend" accessibilityLiveRegion="polite">
          {errorMessage(approve.error)}
        </Text>
      )}
      <Button block label="Yes, my bank" loading={approve.isPending} onPress={() => approve.mutate(code)} />
      <Button block variant="secondary" label="Not mine" disabled={approve.isPending} onPress={() => block(code)} />
    </Card>
  );
}
