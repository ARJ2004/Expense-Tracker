import release from './release.json';

/** The APK on the Download page, written by `pnpm --filter @et/web release:apk <apk>`. */
export interface Release {
  versionName: string | null;
  versionCode: number | null;
  /** e.g. /apk/altus-1.0.0-2.apk */
  apkPath: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  signingCertSha256: string | null;
  /** ISO date, e.g. 2026-12-01 */
  date: string | null;
}

export const apk = release as Release;

const MB = 1024 * 1024;
export const apkSize = apk.sizeBytes ? `${(apk.sizeBytes / MB).toFixed(1)} MB` : '[APK SIZE]';
export const apkVersion = apk.versionName ?? '[VERSION]';
export const apkDate = apk.date
  ? new Date(`${apk.date}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  : '[DATE]';
/** Until the first APK is published, the button points at /get (which the CloudFront Function redirects). */
export const apkHref = apk.apkPath ?? '/get';
