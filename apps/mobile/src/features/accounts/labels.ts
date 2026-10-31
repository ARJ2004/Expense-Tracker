import type { Account, AccountKind } from '@et/api-client';
import type { ChipOption } from '../../ui';

export const KIND_OPTIONS: ReadonlyArray<ChipOption<AccountKind>> = [
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash' },
];

export const kindLabel = (kind: AccountKind) => KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;

/** "HDFC Bank ••1234" or just "Cash". */
export const accountName = (a: Pick<Account, 'bankName' | 'maskedNumber'>) => (a.maskedNumber ? `${a.bankName} ••${a.maskedNumber}` : a.bankName);
