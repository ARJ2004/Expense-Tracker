import React from 'react';
import type { GoalDay } from '@et/api-client';
import { DayDots, type DayDotLook } from '../../../components';

const LOOK: Record<GoalDay['status'], DayDotLook> = { met: 'done', covered: 'soft', missed: 'missed', pending: 'pending', none: 'none' };
const SAID: Record<GoalDay['status'], string> = {
  met: 'saved',
  covered: 'missed, but ahead of plan',
  missed: 'missed',
  pending: 'not saved yet',
  none: 'before the goal',
};

/** A goal's last 14 days, oldest first: filled when saved, soft when covered by being ahead. */
export function StreakDots({ days }: { days: readonly GoalDay[] }) {
  return <DayDots label="Last 14 days" days={days.map((d) => ({ day: d.day, look: LOOK[d.status], said: SAID[d.status] }))} />;
}
