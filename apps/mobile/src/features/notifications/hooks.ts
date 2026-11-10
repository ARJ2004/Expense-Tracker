import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationList, NotificationSettings, NotificationType } from '@et/api-client';
import { api, ledgerRoots, toApiError } from '../../lib';

export const notificationKeys = {
  all: ledgerRoots.notifications,
  inbox: [...ledgerRoots.notifications, 'inbox'] as const,
  settings: [...ledgerRoots.notifications, 'settings'] as const,
};

/** The inbox and its unread count (the bell's badge). */
export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.inbox,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<NotificationList> => {
      const { data, error } = await api.GET('/v1/notifications');
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error, response } = await api.POST('/v1/notifications/read');
      if (!response.ok) throw toApiError(error);
    },
    // Only the bell's count drops now; the list keeps its "new" dots until it's next fetched.
    onSuccess: () => queryClient.setQueryData<NotificationList>(notificationKeys.inbox, (old) => (old ? { ...old, unreadCount: 0 } : old)),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings,
    queryFn: async (): Promise<NotificationSettings> => {
      const { data, error } = await api.GET('/v1/notifications/settings');
      if (!data) throw toApiError(error);
      return data;
    },
  });
}

/** Saves the switched-off types; the screen shows the change at once and rolls back on failure. */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (disabledTypes: NotificationType[]): Promise<NotificationSettings> => {
      const { data, error } = await api.PUT('/v1/notifications/settings', { body: { disabledTypes } });
      if (!data) throw toApiError(error);
      return data;
    },
    onMutate: async (disabledTypes) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.settings });
      const before = queryClient.getQueryData<NotificationSettings>(notificationKeys.settings);
      if (before) {
        queryClient.setQueryData<NotificationSettings>(notificationKeys.settings, {
          ...before,
          items: before.items.map((i) => ({ ...i, enabled: !disabledTypes.includes(i.type) })),
        });
      }
      return { before };
    },
    onError: (_e, _v, context) => context?.before && queryClient.setQueryData(notificationKeys.settings, context.before),
    onSuccess: (data) => queryClient.setQueryData(notificationKeys.settings, data),
  });
}

export function useSendTestNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await api.POST('/v1/notifications/test');
      if (!data) throw toApiError(error);
      return data.result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox }),
  });
}
