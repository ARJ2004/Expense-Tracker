import { useMutation } from '@tanstack/react-query';
import type { Me } from '@et/api-client';
import { toPaise } from '@et/domain';
import { api, toApiError } from '../../lib';
import { useSession } from '../auth';
import { useOnboardingDraft } from './draft';

/** Sends the income answers; the session's user flips to onboarded and navigation moves to Home. */
export function useCompleteOnboarding() {
  const setUser = useSession((s) => s.setUser);
  const reset = useOnboardingDraft((s) => s.reset);
  return useMutation({
    mutationFn: async (): Promise<Me> => {
      const { incomeDigits, frequency } = useOnboardingDraft.getState();
      const body =
        incomeDigits === ''
          ? {}
          : { monthlyIncomePaise: toPaise(incomeDigits), ...(frequency ? { incomeFrequency: frequency } : {}) };
      const { data, error } = await api.POST('/v1/me/onboarding', { body });
      if (!data) throw toApiError(error);
      return data;
    },
    onSuccess: (me) => {
      reset();
      setUser(me);
    },
  });
}
