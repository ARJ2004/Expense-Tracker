import type { GroupActivity, GroupMember } from '@et/api-client';
import { addDays, formatINR, formatISTDate } from '@et/domain';
import type { AvatarTone } from '../../components';

/** Icons offered for a group. */
export const GROUP_EMOJI = ['🏖️', '🏠', '🪔', '✈️', '🍽️', '☕'] as const;

export const rupees = (paise: number) => formatINR(Math.abs(paise), { decimals: 'auto' });

/** The owner is always "You". */
export const memberName = (m: Pick<GroupMember, 'name' | 'isSelf'> | undefined) => (m ? (m.isSelf ? 'You' : m.name) : 'Someone');

const TONES: AvatarTone[] = ['soft', 'amber', 'teal'];

/** You are navy; everyone else cycles green, amber, teal in member order. */
export function memberTone(members: readonly GroupMember[], memberId: string): AvatarTone {
  const i = members.findIndex((m) => m.id === memberId);
  const m = members[i];
  if (!m) return 'neutral';
  if (m.isSelf) return 'navy';
  const others = members.filter((x) => !x.isSelf);
  return TONES[others.indexOf(m) % TONES.length] ?? 'soft';
}

const noonIST = (day: string) => new Date(`${day}T12:00:00+05:30`);

/** "Today · 21 Nov", "Yesterday · 20 Nov" or "18 Nov". */
export function dayLabel(day: string, today: string): string {
  const date = formatISTDate(noonIST(day), { year: false });
  if (day === today) return `Today · ${date}`;
  if (day === addDays(today, -1)) return `Yesterday · ${date}`;
  return date;
}

/** "Today, 21 Nov" for the date row on forms. */
export function dateRowLabel(day: string, today: string): string {
  return dayLabel(day, today).replace(' · ', ', ');
}

export type BalanceTone = 'income' | 'spend' | 'muted';

/** A member's net balance in words: "gets back", "owes" or "settled up". */
export function balanceWords(netPaise: number): { words: string; tone: BalanceTone } {
  if (netPaise > 0) return { words: 'gets back', tone: 'income' };
  if (netPaise < 0) return { words: 'owes', tone: 'spend' };
  return { words: 'settled up', tone: 'muted' };
}

/** The group list's line: "you are owed ₹5,050", "you owe ₹300" or "settled up". */
export function myNetLabel(netPaise: number): { text: string; caption: string; amount?: string; tone: BalanceTone } {
  if (netPaise > 0) return { text: `you are owed ${rupees(netPaise)}`, caption: 'you are owed', amount: rupees(netPaise), tone: 'income' };
  if (netPaise < 0) return { text: `you owe ${rupees(netPaise)}`, caption: 'you owe', amount: rupees(netPaise), tone: 'spend' };
  return { text: 'settled up', caption: 'settled up', tone: 'muted' };
}

export interface ActivityLine {
  title: string;
  subtitle: string;
  /** What it means for the owner: "you owe", "you lent", "you received", "you paid", or nothing. */
  caption: string;
  paise: number;
  tone: BalanceTone;
}

/** How an expense or payment reads in the activity list, from the owner's point of view. */
export function activityLine(item: GroupActivity, members: readonly GroupMember[]): ActivityLine {
  const self = members.find((m) => m.isSelf);
  const byId = (id: string | undefined) => members.find((m) => m.id === id);
  if (item.kind === 'payment') {
    const title = `${memberName(byId(item.fromId))} paid ${memberName(byId(item.toId))}`;
    if (item.toId === self?.id) return { title, subtitle: 'Payment', caption: 'you received', paise: item.amountPaise, tone: 'income' };
    if (item.fromId === self?.id) return { title, subtitle: 'Payment', caption: 'you paid', paise: item.amountPaise, tone: 'spend' };
    return { title, subtitle: 'Payment', caption: 'settle-up', paise: item.amountPaise, tone: 'muted' };
  }
  const payer = byId(item.paidById);
  const subtitle = `${memberName(payer)} paid ${rupees(item.amountPaise)}`;
  const title = item.description ?? 'Expense';
  const myShare = item.shares?.find((s) => s.memberId === self?.id)?.sharePaise ?? 0;
  if (payer?.isSelf) {
    const lent = item.amountPaise - myShare;
    return lent > 0
      ? { title, subtitle, caption: 'you lent', paise: lent, tone: 'income' }
      : { title, subtitle, caption: 'just you', paise: item.amountPaise, tone: 'muted' };
  }
  return myShare > 0
    ? { title, subtitle, caption: 'you owe', paise: myShare, tone: 'spend' }
    : { title, subtitle, caption: 'not involved', paise: 0, tone: 'muted' };
}

/** Activity rows grouped under their day, newest day first (rows arrive newest first). */
export function byDay<T extends { day: string }>(items: readonly T[]): { day: string; items: T[] }[] {
  const days: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const last = days.at(-1);
    if (last && last.day === item.day) last.items.push(item);
    else days.push({ day: item.day, items: [item] });
  }
  return days;
}

/** The name someone goes by in a group they make or join: their first name, else their email's start. */
export function myGroupName(user: { name: string | null; email: string } | null | undefined): string {
  const raw = user?.name?.trim() || user?.email?.split('@')[0] || 'Me';
  return (raw.split(/\s+/)[0] ?? raw).slice(0, 30);
}
