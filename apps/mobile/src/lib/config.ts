/**
 * API base URL: the API on EC2 behind Nginx (`/altus/` → port 4000), for debug and release builds.
 * It has no domain or certificate yet, so release builds allow plain HTTP to this one IP
 * (android/app/src/main/res/xml/network_security_config.xml). Switch to HTTPS before a Play release.
 * For an API running on this Mac, use 'http://10.0.2.2:4000' (emulator).
 */
export const API_BASE_URL = 'http://15.252.181.82/altus';
/**
 * OAuth 2.0 *Web* client ID from Google Cloud Console (the same value as the API's
 * GOOGLE_WEB_CLIENT_ID). Empty until the OAuth clients are created; Google sign-in then
 * explains it isn't set up yet and debug builds use dev sign-in instead.
 */
export const GOOGLE_WEB_CLIENT_ID = '366793425450-a4vsdhja5qbsirdc4en238v84epiro8m.apps.googleusercontent.com';

/** Debug builds offer "Continue as dev user", which the API accepts only with DEV_AUTH_ENABLED. */
export const DEV_SIGN_IN_EMAIL = __DEV__ ? 'dev@altus.local' : null;

/** Sentry DSN for crash reports; empty keeps Sentry off (debug builds and until the project exists). */
export const SENTRY_DSN = '';
