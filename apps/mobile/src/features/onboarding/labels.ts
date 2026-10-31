import type { AccountKind, IncomeFrequency } from '@et/api-client';
import type { ChipOption } from '../../ui';

export const FREQUENCY_OPTIONS: ReadonlyArray<ChipOption<IncomeFrequency>> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'twice_monthly', label: 'Twice a month' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'irregular', label: 'Irregular' },
];

export const KIND_OPTIONS: ReadonlyArray<ChipOption<AccountKind>> = [
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash' },
];

export const kindLabel = (kind: AccountKind) => KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
