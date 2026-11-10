/** A push to one device. data values are strings (FCM's rule). */
export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** sent; invalid: the token is dead (app uninstalled), drop the device; failed: try next time. */
export type PushOutcome = 'sent' | 'invalid' | 'failed';

/** The port to a push service. FCM in production; a no-op when Firebase isn't configured. */
export interface PushSender {
  readonly enabled: boolean;
  send(message: PushMessage): Promise<PushOutcome>;
}

export const PUSH_SENDER = Symbol('PUSH_SENDER');
