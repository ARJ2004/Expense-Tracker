import type { NotificationGroup } from '@et/api-client';
import { formatISTRelative } from '@et/domain';

export const GROUP_LABELS: Record<NotificationGroup, string> = {
  daily: 'Daily',
  alerts: 'Spending alerts',
  rewards: 'Streaks and goals',
};

export const when = (iso: string) => formatISTRelative(new Date(iso));

/** What the test button got back. */
export const TEST_RESULT: Record<string, string> = {
  sent: 'Sent. It should arrive on this phone in a moment.',
  no_device: 'Saved to your inbox. Push isn’t set up on this phone or the server yet.',
  held: 'Held for quiet hours.',
  failed: 'The push service didn’t take it. It’s in your inbox.',
};
