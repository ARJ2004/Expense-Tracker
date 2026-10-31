import { formatINR } from '@et/domain';

/** "₹75,000 / month", or "Not set". The stored figure is monthly whatever the pay frequency. */
export function incomeLabel(monthlyIncomePaise: number | null): string {
  return monthlyIncomePaise ? `${formatINR(monthlyIncomePaise, { decimals: 'auto' })} / month` : 'Not set';
}

/** "Adarsh R" → "AR"; falls back to the email's first letter. */
export function initials(name: string | null | undefined, email: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (email?.[0] ?? '?').toUpperCase();
}
