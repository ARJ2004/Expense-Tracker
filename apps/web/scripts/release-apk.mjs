// Records a signed APK for the Download page: version, size, SHA-256 and date, written to
// src/data/release.json. Run it after building the APK, then commit and deploy the site.
// Usage: pnpm --filter @et/web release:apk <path/to/app-release.apk> <versionName> <versionCode> [signingCertSha256]
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const [apkPath, versionName, versionCode, signingCertSha256 = null] = process.argv.slice(2);
if (!apkPath || !versionName || !/^\d+$/.test(versionCode ?? '')) {
  console.error('Usage: release:apk <apk> <versionName> <versionCode> [signingCertSha256]');
  process.exit(1);
}
const bytes = readFileSync(apkPath);
const release = {
  versionName,
  versionCode: Number(versionCode),
  apkPath: `/apk/altus-${versionName}-${versionCode}.apk`,
  sizeBytes: statSync(apkPath).size,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  signingCertSha256,
  date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
};
writeFileSync(new URL('../src/data/release.json', import.meta.url), `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify(release, null, 2));
console.log(`\nUpload it with: ./infra/web/publish-apk.sh ${apkPath} ${versionName} ${versionCode}`);
