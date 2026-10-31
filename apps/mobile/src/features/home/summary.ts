import type { DashboardSummary } from '@et/api-client';
import type { HeroCardProps } from '../../components';

/** The hero card's figures for a month, from the summary. Pure, so it's tested without rendering. */
export function heroFigures(s: DashboardSummary, isCurrentMonth: boolean, monthName: string): HeroCardProps {
  const label = isCurrentMonth ? 'Spent this month' : `Spent in ${monthName}`;
  if (s.monthlyIncomePaise === null || s.leftToSpendPaise === null || s.usedPercent === null) {
    // No income on the profile: show what came in and the net instead of a budget.
    return {
      label,
      paise: s.spendPaise,
      stats: [
        { label: 'Income', paise: s.incomePaise, tone: 'income' },
        { label: s.netPaise < 0 ? 'Overspent' : 'Saved', paise: Math.abs(s.netPaise) },
      ],
    };
  }
  const over = s.leftToSpendPaise < 0;
  return {
    label,
    paise: s.spendPaise,
    pill: `${s.usedPercent}% used`,
    progress: s.usedPercent / 100,
    stats: [
      { label: 'Income', paise: s.monthlyIncomePaise, tone: 'income' },
      { label: over ? 'Over by' : 'Left to spend', paise: Math.abs(s.leftToSpendPaise) },
    ],
  };
}

/** Each bar's length against the largest category (the first, since the API sorts by spend). */
export function barRatio(spendPaise: number, largestPaise: number): number {
  return largestPaise > 0 ? spendPaise / largestPaise : 0;
}
