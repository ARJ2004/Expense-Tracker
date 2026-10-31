import type { ErrorResponse } from '@et/api-client';

const MESSAGES: Record<string, string> = {
  ACCOUNT_EXISTS: "You've already added this account.",
  ACCOUNT_REQUIRED: 'Pick the account this statement is for.',
  FILE_TOO_LARGE: 'That file is over 10 MB. Export a shorter period.',
  IMPORT_NOT_IN_REVIEW: 'This import was already added.',
  IMPORT_NOT_LOCKED: 'This statement is already open.',
  IMPORT_WRONG_PASSWORD: "That password didn't open the statement. Check it and try again.",
  IMPORT_UNSUPPORTED_FORMAT: 'Upload a CSV, Excel (.xlsx) or PDF statement.',
  ALREADY_ONBOARDED: 'Your setup is already finished.',
  AUTH_GOOGLE_NOT_CONFIGURED: "Google sign-in isn't set up yet.",
  AUTH_INVALID_GOOGLE_TOKEN: "We couldn't verify your Google account. Try again.",
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
  VALIDATION_FAILED: 'Some details look wrong. Check them and try again.',
};

/** An API failure carrying the stable error code, so screens can map it to plain words. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Turns an openapi-fetch error body (or a network failure) into an ApiError. */
export function toApiError(error: ErrorResponse | undefined): ApiError {
  if (!error) return new ApiError('NETWORK', "Can't reach Altus. Check your connection.");
  return new ApiError(error.error.code, MESSAGES[error.error.code] ?? 'Something went wrong. Try again.');
}

/** Plain-words message for anything a mutation or query threw. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Can't reach Altus. Check your connection.";
}
