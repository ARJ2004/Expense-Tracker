/**
 * Category icon names; the app maps each to a line icon.
 * Colours are theme palette keys, not hex, so light and dark mode both work.
 */
export const CATEGORY_ICONS = [
  'food',
  'groceries',
  'transport',
  'shopping',
  'bills',
  'rent',
  'entertainment',
  'health',
  'education',
  'travel',
  'cash',
  'transfer',
  'income',
  'other',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export const CATEGORY_COLORS = ['chart1', 'chart2', 'chart3', 'chart4', 'chart5', 'accent', 'warning', 'muted'] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface SystemCategory {
  id: string;
  key: string;
  name: string;
  icon: CategoryIcon;
  color: CategoryColor;
  isExpense: boolean;
  sortOrder: number;
}

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** The 14 system categories. Ids are fixed: the migration inserts exactly these rows. */
export const SYSTEM_CATEGORIES: readonly SystemCategory[] = [
  { id: id(1), key: 'food_dining', name: 'Food & Dining', icon: 'food', color: 'chart2', isExpense: true, sortOrder: 1 },
  { id: id(2), key: 'groceries', name: 'Groceries', icon: 'groceries', color: 'chart3', isExpense: true, sortOrder: 2 },
  { id: id(3), key: 'transport', name: 'Transport', icon: 'transport', color: 'chart1', isExpense: true, sortOrder: 3 },
  { id: id(4), key: 'shopping', name: 'Shopping', icon: 'shopping', color: 'warning', isExpense: true, sortOrder: 4 },
  { id: id(5), key: 'bills_utilities', name: 'Bills & Utilities', icon: 'bills', color: 'chart5', isExpense: true, sortOrder: 5 },
  { id: id(6), key: 'rent', name: 'Rent', icon: 'rent', color: 'chart1', isExpense: true, sortOrder: 6 },
  { id: id(7), key: 'entertainment', name: 'Entertainment', icon: 'entertainment', color: 'chart3', isExpense: true, sortOrder: 7 },
  { id: id(8), key: 'health', name: 'Health', icon: 'health', color: 'chart2', isExpense: true, sortOrder: 8 },
  { id: id(9), key: 'education', name: 'Education', icon: 'education', color: 'chart4', isExpense: true, sortOrder: 9 },
  { id: id(10), key: 'travel', name: 'Travel', icon: 'travel', color: 'chart5', isExpense: true, sortOrder: 10 },
  // Cash taken out at an ATM: spend whose real destination the bank never sees (added in Sprint 6).
  { id: id(14), key: 'cash', name: 'Cash', icon: 'cash', color: 'chart4', isExpense: true, sortOrder: 11 },
  { id: id(11), key: 'transfers', name: 'Transfers', icon: 'transfer', color: 'muted', isExpense: false, sortOrder: 12 },
  { id: id(12), key: 'income', name: 'Income', icon: 'income', color: 'accent', isExpense: false, sortOrder: 13 },
  { id: id(13), key: 'other', name: 'Other', icon: 'other', color: 'muted', isExpense: true, sortOrder: 14 },
];

export const OTHER_CATEGORY_ID = id(13);
export const INCOME_CATEGORY_ID = id(12);
export const TRANSFERS_CATEGORY_ID = id(11);
export const CASH_CATEGORY_ID = id(14);
