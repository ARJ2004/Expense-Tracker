import type { ConfigService } from '@nestjs/config';
import { DevIdTokenVerifier } from './dev-id-token.verifier';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

const config = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('DevIdTokenVerifier', () => {
  it('claims dev tokens only when enabled', () => {
    expect(new DevIdTokenVerifier(config({ DEV_AUTH_ENABLED: true })).accepts('dev:a@b.co')).toBe(true);
    expect(new DevIdTokenVerifier(config({ DEV_AUTH_ENABLED: false })).accepts('dev:a@b.co')).toBe(false);
    expect(new DevIdTokenVerifier(config({ DEV_AUTH_ENABLED: true })).accepts('eyJhbGciOi')).toBe(false);
  });

  it('derives a stable sub from the lower-cased email', async () => {
    const profile = await new DevIdTokenVerifier(config({ DEV_AUTH_ENABLED: true })).verify('dev:Asha@Example.com');
    expect(profile).toEqual({ sub: 'dev|asha@example.com', email: 'asha@example.com', name: 'asha' });
  });
});

describe('GoogleIdTokenVerifier', () => {
  it('answers 503 until the Web client ID is configured', async () => {
    await expect(new GoogleIdTokenVerifier(config({ GOOGLE_WEB_CLIENT_ID: '' })).verify('x')).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_NOT_CONFIGURED',
      status: 503,
    });
  });

  it('rejects a token that is not a valid Google JWT', async () => {
    await expect(new GoogleIdTokenVerifier(config({ GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' })).verify('not-a-jwt')).rejects.toMatchObject({
      code: 'AUTH_INVALID_GOOGLE_TOKEN',
      status: 401,
    });
  });
});
