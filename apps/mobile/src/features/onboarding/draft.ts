import { create } from 'zustand';
import type { IncomeFrequency } from '@et/api-client';

export type FirstSource = 'statement' | 'manual';

interface OnboardingDraft {
  /** Whole rupees as typed; "" when skipped. */
  incomeDigits: string;
  frequency: IncomeFrequency | null;
  source: FirstSource | null;
  setIncome: (digits: string) => void;
  setFrequency: (frequency: IncomeFrequency) => void;
  setSource: (source: FirstSource) => void;
  skipIncome: () => void;
  reset: () => void;
}

const empty = { incomeDigits: '', frequency: null, source: null } as const;

/** Answers kept across the three steps until onboarding is finished. */
export const useOnboardingDraft = create<OnboardingDraft>((set) => ({
  ...empty,
  setIncome: (incomeDigits) => set({ incomeDigits }),
  setFrequency: (frequency) => set({ frequency }),
  setSource: (source) => set({ source }),
  skipIncome: () => set({ incomeDigits: '', frequency: null }),
  reset: () => set(empty),
}));

/**
 * The tab the app opens on right after onboarding: Imports when the user chose "Import a
 * statement", so the first thing they see is the upload card. Read once by the tabs.
 */
export const useLandingTab = create<{ tab: 'Home' | 'Imports'; take: () => 'Home' | 'Imports'; set: (tab: 'Home' | 'Imports') => void }>((set, get) => ({
  tab: 'Home',
  take: () => {
    const { tab } = get();
    set({ tab: 'Home' });
    return tab;
  },
  set: (tab) => set({ tab }),
}));
