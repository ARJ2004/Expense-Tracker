import type { Allowance, Budget } from '@et/api-client';
import { formatINR } from '@et/domain';

/** Whole rupees with the symbol: "₹1,480". */
export const rupees = (paise: number) => formatINR(Math.round(Math.abs(paise) / 100) * 100, { decimals: 'auto' });

/** Under a budget bar: "of ₹8,000 · ₹1,480 left", "₹400 over", "fixed · of ₹15,000". */
export function budgetMeta(b: Budget): string {
  const left = b.amountPaise - b.spentPaise;
  const of = `of ${rupees(b.amountPaise)}`;
  if (b.isFixed) return `Fixed · ${of}`;
  if (left < 0) return `${of} · ${rupees(left)} over`;
  if (b.overshootPaise > 0) return `${of} · on pace to go ${rupees(b.overshootPaise)} over`;
  return `${of} · ${rupees(left)} left`;
}

/** The allowance card's line under the big number. */
export function allowanceLine(a: Allowance): string {
  if (a.allowancePaise === 0) return 'This month’s plan is used up. Spend only what you must.';
  if (a.leftTodayPaise < 0) return `${rupees(-a.leftTodayPaise)} over today’s ${rupees(a.allowancePaise)}. Tomorrow’s will be a little lower.`;
  return `of ${rupees(a.allowancePaise)} today · ${a.daysLeft} ${a.daysLeft === 1 ? 'day' : 'days'} left this month`;
}

/** Where the allowance comes from, in words. */
export function allowanceBasis(a: Allowance): string {
  const parts = [a.basis === 'income' ? 'Your monthly income' : 'Your budgets'];
  if (a.fixedReservePaise > 0) parts.push(`less ${rupees(a.fixedReservePaise)} fixed costs`);
  if (a.goalReservePaise > 0) parts.push(`less ${rupees(a.goalReservePaise)} for goals`);
  return `${parts.join(', ')}, less what you’ve spent, spread over the days left.`;
}
