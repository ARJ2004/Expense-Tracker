import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { ApiError, GOOGLE_WEB_CLIENT_ID } from '../../lib';

let configured = false;

export const googleSignInConfigured = GOOGLE_WEB_CLIENT_ID.length > 0;

/** Opens the Google account picker. Resolves the ID token, or null if the user backed out. */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  let response;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    response = await GoogleSignin.signIn();
  } catch (e) {
    throw googleError(e);
  }
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken) throw new Error('Google returned no ID token');
  return response.data.idToken;
}

/** Android's CommonStatusCodes, as the native module reports them. */
const DEVELOPER_ERROR = '10';
const NETWORK_ERROR = '7';

/**
 * Google's own failures in plain words. Without this they fell through to "Can't reach Altus",
 * which hid a setup problem (DEVELOPER_ERROR: package name or SHA-1 not registered) as a network one.
 */
function googleError(e: unknown): ApiError {
  const code = isErrorWithCode(e) ? String(e.code) : 'UNKNOWN';
  switch (code) {
    case DEVELOPER_ERROR:
      return new ApiError(
        'AUTH_GOOGLE_DEVELOPER_ERROR',
        __DEV__
          ? "Google sign-in isn't set up for this build (DEVELOPER_ERROR): register its SHA-1 for in.altus.app."
          : "Google sign-in isn't available in this version of the app.",
      );
    case NETWORK_ERROR:
      return new ApiError('AUTH_GOOGLE_NETWORK', "Can't reach Google. Check your connection.");
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return new ApiError('AUTH_GOOGLE_NO_PLAY_SERVICES', 'Google sign-in needs Google Play services on this phone.');
    case statusCodes.IN_PROGRESS:
      return new ApiError('AUTH_GOOGLE_IN_PROGRESS', 'Google sign-in is already open.');
    default:
      return new ApiError('AUTH_GOOGLE_FAILED', __DEV__ ? `Google sign-in failed (${code}). Try again.` : 'Google sign-in failed. Try again.');
  }
}

/** Forget the chosen Google account so the picker shows again next time. */
export async function signOutOfGoogle(): Promise<void> {
  if (!configured) return;
  await GoogleSignin.signOut().catch(() => undefined);
}
