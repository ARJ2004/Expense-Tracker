import { PermissionsAndroid, Platform } from 'react-native';
import SmsInbox from '../../native/NativeSmsInbox';

export type SmsPermission = 'granted' | 'denied' | 'blocked' | 'unavailable';

/**
 * SMS capture needs Android, the native module (absent on iOS and in tests) and a build that
 * declares READ_SMS: Play builds leave it out until the SMS declaration is approved.
 */
export function smsCaptureAvailable(): boolean {
  return Platform.OS === 'android' && !!SmsInbox && SmsInbox.isDeclared();
}

export async function checkSmsPermission(): Promise<SmsPermission> {
  if (!smsCaptureAvailable()) return 'unavailable';
  return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)) ? 'granted' : 'denied';
}

/**
 * Shows Android's READ_SMS prompt. Call only from the "Allow" button of the in-app disclosure
 * (Play policy: the disclosure comes first, every time). "blocked" means Android will not ask
 * again and the user has to allow it in system settings.
 */
export async function requestSmsPermission(): Promise<SmsPermission> {
  if (!smsCaptureAvailable()) return 'unavailable';
  // Already allowed (e.g. in Android settings after "don't ask again"): no prompt needed.
  if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS)) return 'granted';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}
