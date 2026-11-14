import { useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getApps } from '@react-native-firebase/app';
import {
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { api, ledgerRoots, onBeforeSignOut } from '../../lib';

/**
 * Push on this phone. Firebase starts only when the build has a google-services.json; without one
 * every function here is a no-op and notifications still reach the in-app inbox.
 */
export function pushAvailable(): boolean {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
}

const needsRuntimePermission = Platform.OS === 'android' && Number(Platform.Version) >= 33;

async function permitted(): Promise<boolean> {
  if (!needsRuntimePermission) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

let registeredToken: string | null = null;

async function register(token: string): Promise<void> {
  const { response } = await api.POST('/v1/devices', { body: { token, platform: 'android' } });
  if (response.ok) registeredToken = token;
}

/** Sign-out: this phone stops getting the user's pushes. */
onBeforeSignOut(async () => {
  if (!registeredToken) return;
  await api.POST('/v1/devices/unregister', { body: { token: registeredToken } }).catch(() => undefined);
  registeredToken = null;
});

export type PushStatus = 'on' | 'blocked' | 'unavailable';

/** For Settings: on, switched off for Altus in Android, or not set up in this build. */
export function usePushStatus(): PushStatus {
  const [status, setStatus] = useState<PushStatus>(pushAvailable() ? 'on' : 'unavailable');
  useEffect(() => {
    if (!pushAvailable()) return;
    const check = () => {
      permitted()
        .then((ok) => setStatus(ok ? 'on' : 'blocked'))
        .catch(() => setStatus('blocked'));
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);
  return status;
}

type Data = Record<string, string | undefined>;
const dataOf = (m: RemoteMessage | null): Data | null => (m?.data as Data | undefined) ?? null;

/**
 * Signed in: ask for the notification permission once (Android 13+), register this phone's token
 * and keep it fresh, refresh the inbox when a push arrives in the foreground, and open the right
 * screen when a push is tapped.
 */
export function usePushRegistration(onOpen: (data: Data) => void): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!pushAvailable()) return;
    const messaging = getMessaging();
    let cancelled = false;

    (async () => {
      try {
        if (needsRuntimePermission && !(await permitted())) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
            title: 'Daily allowance and alerts',
            message: 'Altus can tell you what you can spend each morning, sum up your day at 9 pm and warn you before a budget runs out. Never between 10 pm and 8 am.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not now',
          });
        }
        const token = await getToken(messaging);
        if (!cancelled) await register(token);
        const opened = dataOf(await getInitialNotification(messaging));
        if (opened && !cancelled) onOpen(opened);
      } catch {
        // No Firebase app or no network: try again next launch.
      }
    })().catch(() => undefined);

    const unsubscribe = [
      onTokenRefresh(messaging, (token) => {
        register(token).catch(() => undefined);
      }),
      onMessage(messaging, async () => {
        await queryClient.invalidateQueries({ queryKey: ledgerRoots.notifications });
      }),
      onNotificationOpenedApp(messaging, (m) => {
        const data = dataOf(m);
        if (data) onOpen(data);
      }),
    ];
    return () => {
      cancelled = true;
      unsubscribe.forEach((u) => u());
    };
    // onOpen is stable for the navigator's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
