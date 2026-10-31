import { create } from 'zustand';
import type { Direction, TransactionDetail } from '@et/api-client';
import { formatINR } from '@et/domain';
import { newUuid } from '../../lib';

interface AddSheetState {
  visible: boolean;
  /** Set when editing an existing transaction. */
  editId: string | null;
  /** Typed rupee string from the keypad. */
  amount: string;
  direction: Direction;
  categoryId: string | null;
  accountId: string | null;
  /** ISO timestamp. */
  occurredAt: string;
  merchantName: string;
  note: string;
  /** Fresh per opening, so a retried Save can't create a second transaction. */
  clientRequestId: string;
  openNew: (defaults?: { accountId?: string | null }) => void;
  openEdit: (txn: TransactionDetail) => void;
  close: () => void;
  set: (patch: Partial<Pick<AddSheetState, 'amount' | 'direction' | 'categoryId' | 'accountId' | 'occurredAt' | 'merchantName' | 'note'>>) => void;
}

const blank = () => ({
  editId: null,
  amount: '',
  direction: 'debit' as Direction,
  categoryId: null,
  accountId: null,
  occurredAt: new Date().toISOString(),
  merchantName: '',
  note: '',
  clientRequestId: newUuid(),
});

/** The Add / Edit transaction sheet: whether it's open and the draft inside it. */
export const useAddSheet = create<AddSheetState>((set) => ({
  visible: false,
  ...blank(),
  openNew: (defaults) => set({ ...blank(), accountId: defaults?.accountId ?? null, visible: true }),
  openEdit: (txn) =>
    set({
      ...blank(),
      visible: true,
      editId: txn.id,
      // Paise → the keypad's string form ("486.5" stays exact; no float maths).
      amount: formatINR(txn.amountPaise, { symbol: false, decimals: 'auto' }).replace(/,/g, ''),
      direction: txn.direction,
      categoryId: txn.category.id,
      accountId: txn.account?.id ?? null,
      occurredAt: txn.occurredAt,
      merchantName: txn.merchantName ?? '',
      note: txn.note ?? '',
    }),
  close: () => set({ visible: false }),
  set: (patch) => set(patch),
}));
