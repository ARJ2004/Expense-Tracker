# Release signing and Google sign-in

How to sign Altus for the Play Store and keep Google sign-in working in release builds.
Do this once, before the first Play upload.

## The three keys

Every Android app is signed, and Google sign-in only works for an app whose signing key Google
knows about. Altus has up to three keys over its life:

| Key | Who holds it | Signs | Status |
|-----|--------------|-------|--------|
| **Debug key** | Everyone. `apps/mobile/android/app/debug.keystore`, the standard React Native key, password `android` | Debug builds (`pnpm --filter @et/mobile run android`) | Done. Its SHA-1 is registered |
| **Upload key** | You only. A file you create and back up | Release builds you upload to Play | Not created yet |
| **App signing key** | Google, created inside Play | What users actually install from Play. Google re-signs your upload | Exists after the first upload |

Each key has its own SHA-1 fingerprint, and **each SHA-1 needs its own Android OAuth client** in
Google Cloud (same package `in.altus.app`, different SHA-1). The app's code doesn't change: it
always uses the one **Web client ID**.

> **Why both a Web and an Android client?** The Web client ID is the *audience*: the app asks Google
> for an ID token addressed to it, and the API checks every token was addressed to it. The Android
> clients are the *permission*: Google only hands this app a token if its package name and signing
> SHA-1 match an Android client in the same project. Using an Android client's ID as the audience,
> or missing the Android client for the key that signed the build, both fail with `DEVELOPER_ERROR`.

## Step 1: Create the upload key

Run this once, outside the repo:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore ~/altus-upload.keystore -alias altus-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` asks for:

- **A keystore password.** Use a long, random one and save it in your password manager.
- **Your name, organisation, city, country.** This goes into the certificate; users never see it.
  Your own name or "Altus" is fine.
- **A key password.** PKCS12 keystores use the keystore password for the key too; press Enter to
  accept that.

**Back it up now.** Copy `~/altus-upload.keystore` and both passwords to a safe place outside this
Mac, such as your password manager's file attachments. If you lose the upload key you can't publish
updates until Google support resets it, which takes days.

Never put the keystore or its passwords in the repo. `.gitignore` already refuses `*.keystore`
(except the debug key).

## Step 2: Tell Gradle where it is

Add these four lines to `~/.gradle/gradle.properties` in your home folder, not the project. Create
the file if it doesn't exist:

```properties
ALTUS_UPLOAD_STORE_FILE=/Users/<you>/altus-upload.keystore
ALTUS_UPLOAD_STORE_PASSWORD=<keystore password>
ALTUS_UPLOAD_KEY_ALIAS=altus-upload
ALTUS_UPLOAD_KEY_PASSWORD=<same password>
```

`apps/mobile/android/app/build.gradle` reads these names. When they're missing, a release build is
signed with the debug key instead: fine for a test phone, refused by Play.

## Step 3: Register the upload key with Google sign-in

Get the upload key's SHA-1:

```bash
keytool -list -v -keystore ~/altus-upload.keystore -alias altus-upload
```

Copy the `SHA1:` line. Then, in [Google Cloud Console](https://console.cloud.google.com), in the
project whose IDs start with `366793425450-`:

1. Go to **Google Auth Platform → Clients → Create client**.
2. Set **Application type** to **Android** and **Name** to "Altus Android (upload)".
3. Set **Package name** to `in.altus.app` and paste the upload key's **SHA-1**.
4. Click **Create**. You don't copy this client's ID anywhere.

## Step 4: Build and check the release bundle

Before the first real release, `API_BASE_URL` in `apps/mobile/src/lib/config.ts` must point at the
deployed HTTPS API, not `https://api.altus.invalid`.

```bash
cd apps/mobile/android
./gradlew bundleRelease
```

The bundle is `app/build/outputs/bundle/release/app-release.aab`. Check it is signed with the upload
key, not the debug key:

```bash
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | grep SHA1
```

The SHA-1 must match Step 3. If it shows `5E:8F:16:…`, Gradle didn't find the properties from
Step 2 and used the debug key.

The Play build leaves out the SMS permission until Google approves the SMS permissions declaration
(sprint plan, S10). To sideload a release build that can read SMS, add `-PaltusSms`.

## Step 5: Upload, then register Play's key

1. In [Play Console](https://play.google.com/console), create the app and upload the `.aab` to the
   **Internal testing** track. Accept **Play App Signing** when asked.
2. Go to **Test and release → App integrity → App signing**, or **Protected with Play → Play Store
   protection → Manage Play app signing** in newer consoles. Copy the **App signing key certificate
   SHA-1**. It is *not* your upload key's SHA-1.
3. In Google Cloud, create one more **Android** client: package `in.altus.app` with that SHA-1, named
   "Altus Android (Play)".
4. Wait a few minutes, install from the internal testing link, and sign in with Google.

Without this step, sign-in works for builds you install yourself but fails with `DEVELOPER_ERROR`
for everyone who installs from Play.

## Step 6: Open sign-in to everyone

While the consent screen is in **Testing**, only the accounts under **Audience → Test users** can sign
in. When you're ready for real users, go to **Google Auth Platform → Audience → Publish app**. Altus
only asks for `openid`, `email` and `profile`, so it needs no Google verification review.

## When you're done

In Google Cloud you should have one Web client and three Android clients, all in the same project:

| Client | Type | Package | SHA-1 |
|--------|------|---------|-------|
| Altus Web | Web application | — | — |
| Altus Android | Android | `in.altus.app` | Debug key, `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| Altus Android (upload) | Android | `in.altus.app` | Your upload key |
| Altus Android (Play) | Android | `in.altus.app` | Play's app signing key |

The app's `GOOGLE_WEB_CLIENT_ID` and the API's `GOOGLE_WEB_CLIENT_ID` are both the **Altus Web** ID.

## Troubleshooting

| You see | Cause |
|---------|-------|
| `DEVELOPER_ERROR` | No Android client matches this build's package and SHA-1, or it's in a different project from the Web client, or the code has an Android client ID where the Web one belongs. New or changed clients can take a few minutes to start working |
| "Access blocked" | The consent screen is in Testing and this account isn't a test user |
| The phone signs in, then the API rejects the token | The app's and the API's `GOOGLE_WEB_CLIENT_ID` differ, or the API wasn't restarted after `.env` changed |
| The release build is signed with `5E:8F:16:…` | `~/.gradle/gradle.properties` is missing or misspells an `ALTUS_UPLOAD_*` name |
