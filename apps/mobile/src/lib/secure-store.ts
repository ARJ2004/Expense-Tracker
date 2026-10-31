import * as Keychain from 'react-native-keychain';

/** Polyfilled by react-native-get-random-values (imported first in index.js). */
declare const crypto: { getRandomValues<T extends Uint8Array>(array: T): T };

const REFRESH = { service: 'in.altus.app.refresh' };
const DEVICE = { service: 'in.altus.app.device' };

/** Android Keystore-backed storage for the refresh token and this install's device id. */
export const secureStore = {
  async getRefreshToken(): Promise<string | null> {
    const entry = await Keychain.getGenericPassword(REFRESH);
    return entry ? entry.password : null;
  },

  async setRefreshToken(token: string): Promise<void> {
    await Keychain.setGenericPassword('refresh', token, REFRESH);
  },

  async clearRefreshToken(): Promise<void> {
    await Keychain.resetGenericPassword(REFRESH);
  },

  /** A random id created on first launch; the API ties each refresh token to it. */
  async getDeviceId(): Promise<string> {
    const entry = await Keychain.getGenericPassword(DEVICE);
    if (entry) return entry.password;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await Keychain.setGenericPassword('device', id, DEVICE);
    return id;
  },
};
