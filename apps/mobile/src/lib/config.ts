/**
 * API base URL. Debug builds talk to the API on this Mac through the Android emulator's
 * host alias; release builds must use HTTPS (cleartext is allowed only in debug).
 */
export const API_BASE_URL = __DEV__ ? 'http://10.0.2.2:4000' : 'https://api.altus.invalid';
