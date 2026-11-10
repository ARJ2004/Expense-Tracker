import { Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import type { PushMessage, PushOutcome, PushSender } from './push-sender';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Firebase Cloud Messaging HTTP v1, authenticated with the service account in
 * FIREBASE_SERVICE_ACCOUNT_BASE64 (google-auth-library, already a dependency). Logs outcomes
 * only, never tokens or message text.
 */
export class FcmPushSender implements PushSender {
  readonly enabled = true;
  private readonly logger = new Logger(FcmPushSender.name);
  private readonly auth: GoogleAuth;
  private readonly url: string;

  constructor(account: ServiceAccount) {
    this.auth = new GoogleAuth({
      credentials: { client_email: account.client_email, private_key: account.private_key },
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    this.url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  }

  static fromBase64(encoded: string): FcmPushSender {
    const account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ServiceAccount;
    if (!account.project_id || !account.client_email || !account.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not a service-account key');
    return new FcmPushSender(account);
  }

  async send(m: PushMessage): Promise<PushOutcome> {
    try {
      const token = await this.auth.getAccessToken();
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: m.token,
            notification: { title: m.title, body: m.body },
            data: m.data,
            android: { priority: 'high', notification: { channel_id: 'altus_default' } },
          },
        }),
      });
      if (res.ok) return 'sent';
      // 404 UNREGISTERED / 400 INVALID_ARGUMENT on the token: the app is gone from that phone.
      if (res.status === 404 || (res.status === 400 && (await res.text()).includes('registration token'))) return 'invalid';
      this.logger.warn(`FCM answered ${res.status}`);
      return 'failed';
    } catch (e) {
      this.logger.warn(`FCM send failed: ${(e as Error).message}`);
      return 'failed';
    }
  }
}

/** Firebase not configured yet: notifications still land in the in-app inbox. */
export class InboxOnlyPushSender implements PushSender {
  readonly enabled = false;
  async send(): Promise<PushOutcome> {
    return 'failed';
  }
}
