/**
 * Limits for transactions the phone captures (bank SMS now, notifications in v0.3). The API's
 * CapturedTxnDto validates with these and the phone trims rows to them before sending, so the two
 * can't drift apart.
 */
export const CAPTURE_LIMITS = {
  /** Rows per POST /v1/ingest/batch. */
  maxBatchItems: 100,
  /** A transaction dated further ahead than this (a phone clock far off) is refused. */
  maxFutureMs: 86_400_000,
  bankLength: { min: 1, max: 60 },
  counterpartyLength: { min: 1, max: 80 },
  last4: /^\d{3,4}$/,
  referenceNo: /^[A-Za-z0-9]{6,22}$/,
  /** A short keyword for the type rules (UPI, CARD, ATM WITHDRAWAL, REFUND); never message text. */
  narration: /^[A-Z ]{1,24}$/,
  messageKey: /^[0-9a-f]{64}$/,
} as const;

/** True when `occurredAt` is no further ahead of `now` than a captured row may be. */
export function withinFutureLimit(occurredAt: Date, now: Date = new Date()): boolean {
  return occurredAt.getTime() <= now.getTime() + CAPTURE_LIMITS.maxFutureMs;
}
