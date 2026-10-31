import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../common';
import type { GoogleProfile } from '../../users';
import type { IdTokenVerifier } from './id-token-verifier';

const PREFIX = 'dev:';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Development stand-in until the Google OAuth clients exist: accepts "dev:<email>".
 * Only active when DEV_AUTH_ENABLED=true, which config validation refuses in production.
 */
@Injectable()
export class DevIdTokenVerifier implements IdTokenVerifier {
  readonly name = 'dev';
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('DEV_AUTH_ENABLED') === true;
  }

  accepts(idToken: string): boolean {
    return this.enabled && idToken.startsWith(PREFIX);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    const email = idToken.slice(PREFIX.length).trim().toLowerCase();
    if (!EMAIL.test(email)) {
      throw new AppError('AUTH_INVALID_GOOGLE_TOKEN', 'Dev token must be dev:<email>', HttpStatus.UNAUTHORIZED);
    }
    return { sub: `dev|${email}`, email, name: email.split('@')[0] ?? null };
  }
}
