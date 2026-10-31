/**
 * Closed sets shared by the database, the API and the app.
 * Values match the Prisma enums one to one.
 */
export const Direction = { debit: 'debit', credit: 'credit' } as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export const TxnType = {
  expense: 'expense',
  income: 'income',
  refund: 'refund',
  transfer: 'transfer',
  atm_withdrawal: 'atm_withdrawal',
  cash_deposit: 'cash_deposit',
} as const;
export type TxnType = (typeof TxnType)[keyof typeof TxnType];

export const SourceKind = {
  manual: 'manual',
  sms: 'sms',
  notification: 'notification',
  statement: 'statement',
} as const;
export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];

export const AccountKind = {
  savings: 'savings',
  credit_card: 'credit_card',
  wallet: 'wallet',
  cash: 'cash',
} as const;
export type AccountKind = (typeof AccountKind)[keyof typeof AccountKind];

export const CategorySource = { rule: 'rule', user: 'user', default: 'default' } as const;
export type CategorySource = (typeof CategorySource)[keyof typeof CategorySource];

/** Matches the four choices on the locked onboarding screen. */
export const IncomeFrequency = {
  monthly: 'monthly',
  twice_monthly: 'twice_monthly',
  weekly: 'weekly',
  irregular: 'irregular',
} as const;
export type IncomeFrequency = (typeof IncomeFrequency)[keyof typeof IncomeFrequency];
