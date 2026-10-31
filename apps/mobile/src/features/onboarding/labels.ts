import type { IncomeFrequency } from '@et/api-client';
import type { ChipOption } from '../../ui';

export const FREQUENCY_OPTIONS: ReadonlyArray<ChipOption<IncomeFrequency>> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'twice_monthly', label: 'Twice a month' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'irregular', label: 'Irregular' },
];
