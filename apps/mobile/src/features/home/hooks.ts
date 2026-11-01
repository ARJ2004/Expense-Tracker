import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { DashboardSummary, DashboardTrend, TrendBucket } from '@et/api-client';
import { api, ledgerRoots, toApiError } from '../../lib';

/** Ledger writes refresh everything under ledgerRoots.dashboard (lib/ledger-cache.ts), so every figure here refreshes. */
export const dashboardKeys = {
  all: ledgerRoots.dashboard,
  summary: (month: string) => [...ledgerRoots.dashboard, 'summary', month] as const,
  trend: (from: string, to: string, bucket: TrendBucket) => [...ledgerRoots.dashboard, 'trend', from, to, bucket] as const,
};

/** One IST month's spend, income, categories and merchants. Keeps the last month on screen while the next loads. */
export function useDashboardSummary(month: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(month),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<DashboardSummary> => {
      const { data, error } = await api.GET('/v1/dashboard/summary', { params: { query: { month } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

/** Spend and income per bucket. Built for the trend chart; Home doesn't show it yet. */
export function useDashboardTrend(from: string, to: string, bucket: TrendBucket) {
  return useQuery({
    queryKey: dashboardKeys.trend(from, to, bucket),
    queryFn: async (): Promise<DashboardTrend> => {
      const { data, error } = await api.GET('/v1/dashboard/trend', { params: { query: { from, to, bucket } } });
      if (!data) throw toApiError(error);
      return data;
    },
  });
}
