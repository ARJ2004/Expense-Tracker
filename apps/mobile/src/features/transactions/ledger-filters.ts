import { create } from 'zustand';
import type { LedgerFilters } from '@et/domain';

interface LedgerFilterState {
  /** Applied filters (chips and the filter sheet); search text lives in the screen and is debounced. */
  filters: LedgerFilters;
  replace: (filters: LedgerFilters) => void;
  clear: () => void;
}

/** Kept outside the screen so the filters survive switching tabs. */
export const useLedgerFilters = create<LedgerFilterState>((set) => ({
  filters: {},
  replace: (filters) => set({ filters }),
  clear: () => set({ filters: {} }),
}));
