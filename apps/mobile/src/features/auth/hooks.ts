import { useMutation } from '@tanstack/react-query';
import { api, ApiError, DEV_SIGN_IN_EMAIL, secureStore, toApiError } from '../../lib';
import { getGoogleIdToken, googleSignInConfigured } from './google';
import { useSession } from './session';

export type SignInMethod = 'google' | 'dev';

/** Google (or dev) ID token → API session. Resolves false when the user cancelled the picker. */
export function useSignIn() {
  const signedIn = useSession((s) => s.signedIn);
  return useMutation({
    mutationFn: async (method: SignInMethod): Promise<boolean> => {
      let idToken: string | null;
      if (method === 'dev' && DEV_SIGN_IN_EMAIL) {
        idToken = `dev:${DEV_SIGN_IN_EMAIL}`;
      } else {
        if (!googleSignInConfigured) throw new ApiError('AUTH_GOOGLE_NOT_CONFIGURED', "Google sign-in isn't set up yet.");
        idToken = await getGoogleIdToken();
      }
      if (!idToken) return false;
      const deviceId = await secureStore.getDeviceId();
      const { data, error } = await api.POST('/v1/auth/google', { body: { idToken, deviceId } });
      if (!data) throw toApiError(error);
      await signedIn(data);
      return true;
    },
  });
}

export function useSignOut() {
  const signOut = useSession((s) => s.signOut);
  return useMutation({ mutationFn: signOut });
}
