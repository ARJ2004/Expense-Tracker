import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../../common';
import type { GoogleProfile } from '../../users';
import type { IdTokenVerifier } from './id-token-verifier';

/** Verifies a Google ID token's signature, expiry and audience (our Web client ID). */
@Injectable()
export class GoogleIdTokenVerifier implements IdTokenVerifier {
  readonly name = 'google';
  private readonly client = new OAuth2Client();
  private readonly audience: string | undefined;

  constructor(config: ConfigService) {
    this.audience = config.get<string>('GOOGLE_WEB_CLIENT_ID') || undefined;
  }

  accepts(): boolean {
    return true;
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    if (!this.audience) {
      throw new AppError('AUTH_GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audience });
      payload = ticket.getPayload();
    } catch {
      throw invalid();
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) throw invalid();
    return { sub: payload.sub, email: payload.email, name: payload.name ?? null };
  }
}

function invalid(): AppError {
  return new AppError('AUTH_INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified', HttpStatus.UNAUTHORIZED);
}
