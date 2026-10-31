import type { GoogleProfile } from '../../users';

/**
 * Turns an ID token from the app into a verified Google identity. Verifiers are tried in order;
 * the first whose accepts() returns true decides. Adding a sign-in method = one new verifier.
 */
export interface IdTokenVerifier {
  readonly name: string;
  accepts(idToken: string): boolean;
  /** Resolves the identity or throws AppError AUTH_INVALID_GOOGLE_TOKEN. */
  verify(idToken: string): Promise<GoogleProfile>;
}

export const ID_TOKEN_VERIFIERS = Symbol('ID_TOKEN_VERIFIERS');
