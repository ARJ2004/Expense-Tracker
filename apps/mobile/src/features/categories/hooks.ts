import { useQuery } from '@tanstack/react-query';
import type { Category } from '@et/api-client';
import { api, toApiError } from '../../lib';

export const categoryKeys = { all: ['categories'] as const };

/** System + custom categories, in sort order. Rarely changes, so it stays fresh for an hour. */
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await api.GET('/v1/categories');
      if (!data) throw toApiError(error);
      return data.items;
    },
  });
}
