import 'reflect-metadata';
import { validateConfig } from './app-config';

const base = { DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: 's'.repeat(32) };

describe('validateConfig', () => {
  it('reads "false" as false', () => {
    expect(validateConfig({ ...base, DEV_AUTH_ENABLED: 'false' }).DEV_AUTH_ENABLED).toBe(false);
    expect(validateConfig({ ...base, DEV_AUTH_ENABLED: 'true' }).DEV_AUTH_ENABLED).toBe(true);
  });

  it('refuses a short JWT secret', () => {
    expect(() => validateConfig({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuses dev sign-in or a missing Google client in production', () => {
    const prod = { ...base, NODE_ENV: 'production', GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' };
    expect(() => validateConfig({ ...prod, DEV_AUTH_ENABLED: 'true' })).toThrow(/DEV_AUTH_ENABLED/);
    expect(() => validateConfig({ ...prod, GOOGLE_WEB_CLIENT_ID: '' })).toThrow(/GOOGLE_WEB_CLIENT_ID/);
    expect(validateConfig(prod).DEV_AUTH_ENABLED).toBe(false);
  });
});
