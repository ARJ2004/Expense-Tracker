# Deploying the Altus website (S3 + CloudFront, no domain)

This guide takes you from nothing to a live site at `https://dXXXXXXXXXXXX.cloudfront.net`, with the
app's API and invite links on the same HTTPS address. Follow the parts in order the first time.
Everyday deploys afterwards are automatic (part 11).

Time needed: about 2–3 hours the first time, most of it waiting for AWS.

## Contents

0. [What you are building](#0-what-you-are-building)
1. [Before you start](#1-before-you-start)
2. [Give the server a fixed address (Elastic IP)](#2-give-the-server-a-fixed-address-elastic-ip)
3. [Deploy the API changes](#3-deploy-the-api-changes)
4. [Create the origin secret and the Nginx origin block](#4-create-the-origin-secret-and-the-nginx-origin-block)
5. [Create the AWS infrastructure (CloudFormation)](#5-create-the-aws-infrastructure-cloudformation)
6. [Point the API at the new address](#6-point-the-api-at-the-new-address)
7. [Connect GitHub so it can deploy the site](#7-connect-github-so-it-can-deploy-the-site)
8. [First deploy of the website](#8-first-deploy-of-the-website)
9. [Ship an app build that uses HTTPS, and publish the APK](#9-ship-an-app-build-that-uses-https-and-publish-the-apk)
10. [Launch: fill the placeholders and open the site to Google](#10-launch-fill-the-placeholders-and-open-the-site-to-google)
11. [Everyday: deploys, rollbacks, numbers](#11-everyday-deploys-rollbacks-numbers)
12. [Later: switching off old app builds](#12-later-switching-off-old-app-builds)
13. [Before the Play Store: encrypt CloudFront to EC2](#13-before-the-play-store-encrypt-cloudfront-to-ec2)
14. [Later: moving to your own domain](#14-later-moving-to-your-own-domain)
15. [Troubleshooting](#15-troubleshooting)

---

## 0. What you are building

```
 Browser, WhatsApp preview, the Android app
                │  HTTPS (free *.cloudfront.net certificate)
                ▼
 CloudFront distribution  https://dXXXXXXXXXXXX.cloudfront.net
   ├─ /v1/*   → EC2 (the API)            no caching, all methods
   ├─ /j/*    → EC2 (invite pages)       no caching
   └─ *       → S3 (the website, APKs)   cached; edge functions for clean URLs, /get and 404s
                │                                      │
                ▼ private, only CloudFront can read     ▼ HTTP :80 + secret header (for now)
 S3 bucket altus-web-<account>-ap-south-1     EC2: Nginx → NestJS API (PM2) → PostgreSQL
```

What lives where in the repo:

| Path | What it is |
|---|---|
| `apps/web/` | The website (Astro, static). Pages come from the approved V3 design. |
| `packages/brand/` | Colours, radii and spacing, shared by the app and the website. |
| `apps/api/src/waitlist/` | `POST /v1/waitlist`, the iPhone waitlist form's backend. |
| `infra/web/altus-web.yaml` | CloudFormation: bucket, CloudFront, edge functions, headers, the GitHub deploy role. |
| `infra/web/publish-apk.sh` | Uploads a signed APK and points `/get` at it. |
| `infra/nginx/altus-origin.conf` | The Nginx server block CloudFront talks to on EC2. |
| `.github/workflows/deploy-web.yml` | Builds and publishes the site after CI passes on `main`. |

Monthly cost at today's size: about $0–1 (CloudFront's free tier covers the traffic; S3 storage is cents).

---

## 1. Before you start

**On your Mac**

1. Install the AWS CLI v2 and check it: `aws --version` (2.x).
2. Sign in with an AWS user or SSO profile that can create CloudFormation stacks, S3 buckets,
   CloudFront and IAM roles (an admin profile for this one-time setup):
   ```bash
   aws configure --profile altus        # or: aws configure sso --profile altus
   export AWS_PROFILE=altus AWS_REGION=ap-south-1
   aws sts get-caller-identity          # shows your account id
   ```
3. Have `openssl` (built into macOS) and the repo checked out on `main` with this change merged.

**Access you need**

- SSH to the EC2 instance as `ubuntu` (as in `docs/deploy-ec2.md`).
- Admin on the GitHub repository (to create an environment and variables).

**Write these down as you go** (you'll need them in later parts):

| Name | Where it comes from | Example |
|---|---|---|
| `ELASTIC_IP` | Part 2 | `13.200.10.20` |
| `EC2_DNS` | Part 2 | `ec2-13-200-10-20.ap-south-1.compute.amazonaws.com` |
| `ORIGIN_SECRET` | Part 4 | 64 hex characters |
| `SITE_URL` | Part 5 output | `https://d1a2b3c4d5e6f7.cloudfront.net` |
| `BUCKET`, `DISTRIBUTION_ID`, `KVS_ARN`, `DEPLOY_ROLE_ARN` | Part 5 outputs | |

---

## 2. Give the server a fixed address (Elastic IP)

CloudFront needs a DNS name for the server, and the EC2 DNS name changes whenever the public IP
changes. An Elastic IP keeps it fixed.

1. AWS console → **EC2** → **Elastic IPs** (region **Asia Pacific (Mumbai) ap-south-1**).
2. **Is `15.252.181.82` already listed?**
   - **Yes:** it's already an Elastic IP. Make sure it's associated with the Altus instance and skip to step 5. Old app builds keep working.
   - **No:** continue. Note that associating a new Elastic IP **changes the server's public IP**. App builds that call `http://15.252.181.82/altus` stop working until users install the HTTPS build from part 9. If testers depend on today's build, do parts 2–9 in one sitting.
3. **Allocate Elastic IP address** → **Allocate**.
4. Select it → **Actions** → **Associate Elastic IP address** → choose the Altus instance → **Associate**.
5. EC2 → **Instances** → the Altus instance → copy **Public IPv4 DNS**. That's `EC2_DNS`.
   - If it's empty: VPC console → your VPC → **Actions** → **Edit VPC settings** → tick **Enable DNS hostnames** → save, then check again.
6. If the IP changed, update your SSH config and `ALTUS_DEPLOY_HOST` (see `docs/deploy-ec2.md`).

---

## 3. Deploy the API changes

This change adds the waitlist endpoint (with a database migration) and makes rate limits see each
visitor's real IP.

1. From your Mac, on `main` with this change merged:
   ```bash
   pm2 deploy apps/api/ecosystem.config.js production
   ```
   The deploy runs `prisma:deploy`, which creates the `waitlist_entries` table.
2. Check it on the server:
   ```bash
   ssh ubuntu@<ELASTIC_IP>
   pm2 status                                   # altus-api online
   curl -s localhost:4000/v1/health              # {"status":"ok","db":"ok",…}
   ```

Nothing else changes yet: `TRUST_PROXY` defaults to `loopback`, which is right for Nginx on the same box.

---

## 4. Create the origin secret and the Nginx origin block

CloudFront will send a secret header on every request to the server. Nginx refuses origin requests
without it, so nobody can put their own CloudFront in front of your API.

1. **Make the secret** (on your Mac) and keep it in your password manager:
   ```bash
   openssl rand -hex 32
   ```
2. **Copy the reference config to the server:**
   ```bash
   scp infra/nginx/altus-origin.conf ubuntu@<ELASTIC_IP>:/tmp/altus-origin.conf
   ssh ubuntu@<ELASTIC_IP>
   ```
3. **On the server:**
   ```bash
   # The secret check. Not in git, readable only by root.
   echo 'if ($http_x_origin_verify != "PASTE_ORIGIN_SECRET_HERE") { return 403; }' | sudo tee /etc/nginx/altus-origin-secret.conf > /dev/null
   sudo chmod 600 /etc/nginx/altus-origin-secret.conf

   # The origin server block, with your EC2 DNS name.
   sed "s/ORIGIN_HOST/<EC2_DNS>/" /tmp/altus-origin.conf | sudo tee /etc/nginx/conf.d/altus-origin.conf > /dev/null

   sudo nginx -t && sudo systemctl reload nginx
   ```
   - If your Nginx keeps sites in `sites-enabled/` and not `conf.d/`, put the file there instead (`/etc/nginx/sites-enabled/altus-origin.conf`).
   - Leave your existing `/altus/` server block alone: it keeps old app builds working until part 12.
4. **Test it from the server:**
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: <EC2_DNS>' localhost/v1/health                                  # 403 (no secret)
   curl -s -H 'Host: <EC2_DNS>' -H 'X-Origin-Verify: <ORIGIN_SECRET>' localhost/v1/health                             # {"status":"ok",…}
   ```
5. **Security group:** EC2 → the instance → **Security** → the security group → **Inbound rules**.
   Port **80** must be reachable by CloudFront:
   - Today port 80 is probably open to `0.0.0.0/0` for old app builds. Leave it like that for now. The secret header protects the new block. Tighten it in part 12.
   - Port **443**: not needed. Ports **4000** and **5432**: must **not** be open.
   - Port **22**: only your own IP.

---

## 5. Create the AWS infrastructure (CloudFormation)

One command creates the bucket, the CloudFront distribution, the edge functions, security headers
and the role GitHub uses to deploy.

1. **Does your account already have the GitHub OIDC provider?** IAM → **Identity providers**. If
   `token.actions.githubusercontent.com` is listed, use `CreateGitHubOidcProvider=false` below,
   otherwise `true`.
2. **Deploy the stack** (from the repo root on your Mac):
   ```bash
   aws cloudformation deploy \
     --region ap-south-1 \
     --stack-name altus-web \
     --template-file infra/web/altus-web.yaml \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       Ec2OriginDomain=<EC2_DNS> \
       OriginSecret=<ORIGIN_SECRET> \
       GitHubRepo=ARJ2004/Expense-Tracker \
       CreateGitHubOidcProvider=true
   ```
   It takes 5–15 minutes, mostly CloudFront. Prefer the console? CloudFormation → **Create stack** →
   upload `infra/web/altus-web.yaml` → fill the same four parameters → tick the IAM acknowledgement.
3. **Read the outputs** and write them down:
   ```bash
   aws cloudformation describe-stacks --region ap-south-1 --stack-name altus-web \
     --query 'Stacks[0].Outputs' --output table
   ```
   You get `SiteUrl`, `DistributionId`, `BucketName`, `KeyValueStoreArn` and `DeployRoleArn`.
4. **Test the API through CloudFront** (works now, before the site is deployed):
   ```bash
   curl -s <SITE_URL>/v1/health          # {"status":"ok","db":"ok",…}
   curl -s -o /dev/null -w '%{http_code}\n' <SITE_URL>/       # 403 or 404 until part 8 uploads the site
   ```

> **Treat the distribution as permanent.** Its `dXXXX.cloudfront.net` name becomes the app's API
> address, the invite-link host and the QR code target. The template keeps the distribution and the
> bucket if the stack is ever deleted. Never edit a setting that would replace the distribution, and
> review change sets before applying template changes.

---

## 6. Point the API at the new address

Invite links (`/j/<code>`) are built from `PUBLIC_WEB_BASE_URL`.

1. On the server, add one line to `/home/ubuntu/altus/shared/api.env` (no trailing slash):
   ```bash
   echo 'PUBLIC_WEB_BASE_URL=<SITE_URL>' >> /home/ubuntu/altus/shared/api.env
   pm2 reload altus-api --update-env
   ```
2. Check that rate limits see real visitor IPs: from two different networks (for example phone data
   and home Wi-Fi), send six quick waitlist requests each:
   ```bash
   for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w '%{http_code} ' -X POST <SITE_URL>/v1/waitlist -H 'Content-Type: application/json' -d '{"email":"test'$i'@example.com"}'; done; echo
   ```
   Expect `202 202 202 202 202 429` on each network separately. Then clear the test rows:
   ```bash
   psql "$DATABASE_URL" -c "DELETE FROM waitlist_entries WHERE email LIKE 'test%@example.com';"
   ```

---

## 7. Connect GitHub so it can deploy the site

GitHub signs in to AWS with OIDC, so no AWS keys are stored in GitHub.

1. GitHub → the repository → **Settings** → **Environments** → **New environment** → name it
   exactly **`production`**. Optional: add yourself under **Required reviewers** so every deploy
   waits for your click.
2. **Settings** → **Secrets and variables** → **Actions** → **Variables** tab → **New repository
   variable**, one per row:

   | Variable | Value |
   |---|---|
   | `AWS_DEPLOY_ROLE_ARN` | the `DeployRoleArn` output |
   | `SITE_BUCKET` | the `BucketName` output |
   | `CLOUDFRONT_DISTRIBUTION_ID` | the `DistributionId` output |
   | `CLOUDFRONT_KVS_ARN` | the `KeyValueStoreArn` output |
   | `SITE_URL` | the `SiteUrl` output, e.g. `https://d1a2b3c4d5e6f7.cloudfront.net` |
   | `PUBLIC_PRELAUNCH` | `1` (keeps Google out and allows placeholders; set to `0` at launch, part 10) |

   None of these are secrets. There are no repository secrets to add.

---

## 8. First deploy of the website

1. GitHub → **Actions** → **Deploy website** → **Run workflow** → branch `main` → **Run**.
   (After this, every push to `main` deploys automatically once CI is green.)
2. The run builds `apps/web`, uploads it to S3, publishes the page list to the edge function,
   invalidates CloudFront and runs a smoke test. It takes about 3 minutes.
3. Open `<SITE_URL>` in a browser and check:
   - [ ] Home, Features, Compare, About and Download load, in the app's fonts.
   - [ ] `<SITE_URL>/features/` redirects to `<SITE_URL>/features`.
   - [ ] `<SITE_URL>/nope` shows the branded 404 page.
   - [ ] Download → **Join the waitlist** with your email shows "You're on the list."
   - [ ] `<SITE_URL>/get` goes to `/download` (until part 9 publishes an APK).
   - [ ] `<SITE_URL>/robots.txt` says `Disallow: /` (pre-launch).

---

## 9. Ship an app build that uses HTTPS, and publish the APK

This makes the app talk to `<SITE_URL>` over HTTPS and publishes the APK the website offers.

### 9.1 Point the app at CloudFront

In `apps/mobile`:

1. `src/lib/config.ts`: set the base URL to the bare CloudFront address, with **no** `/v1` and **no** `/altus`
   (the app's request paths already start with `/v1/`):
   ```ts
   export const API_BASE_URL = 'https://d1a2b3c4d5e6f7.cloudfront.net';
   ```
2. `android/app/src/main/res/xml/network_security_config.xml`: delete the `<domain-config>` block for
   `15.252.181.82`, so release builds are HTTPS-only. Leave `<base-config cleartextTrafficPermitted="false" />`.
3. `android/app/src/main/AndroidManifest.xml`: replace the `http` / `15.252.181.82` / `/altus/j/`
   intent filter with a verified App Link (keep the `altus://j` filter):
   ```xml
   <intent-filter android:autoVerify="true">
       <action android:name="android.intent.action.VIEW" />
       <category android:name="android.intent.category.DEFAULT" />
       <category android:name="android.intent.category.BROWSABLE" />
       <data android:scheme="https" android:host="d1a2b3c4d5e6f7.cloudfront.net" android:pathPrefix="/j/" />
   </intent-filter>
   ```
4. `android/app/build.gradle`: bump `versionCode` (e.g. `1` → `2`) and `versionName` (e.g. `"1.0.1"`).
   `versionCode` must always go up, and will be shared with Play builds later.

### 9.2 App Links file

1. Get the SHA-256 of your **upload key** (the key from `docs/release-signing.md`):
   ```bash
   keytool -list -v -keystore <your-upload-keystore>.jks -alias <alias> | grep SHA256
   ```
2. Put it in `apps/web/public/.well-known/assetlinks.json` in place of `REPLACE_WITH_UPLOAD_KEY_SHA256`,
   keeping the colons, e.g. `"AB:CD:…:EF"`.

### 9.3 Build and publish the APK

1. Build the signed release APK with SMS on your Mac (as in `docs/release-signing.md`):
   ```bash
   cd apps/mobile/android && ./gradlew assembleRelease -PaltusSms && cd -
   ```
2. Upload it and point `/get` at it:
   ```bash
   ./infra/web/publish-apk.sh apps/mobile/android/app/build/outputs/apk/release/app-release.apk 1.0.1 2
   ```
   (Use your AWS profile from part 1. CI can't write `apk/`; only you can.)
3. Record it on the Download page (version, size, checksum):
   ```bash
   pnpm --filter @et/web release:apk apps/mobile/android/app/build/outputs/apk/release/app-release.apk 1.0.1 2 '<upload key SHA-256>'
   git add apps/web/src/data/release.json apps/web/public/.well-known/assetlinks.json apps/mobile
   git commit -m "Release 1.0.1: HTTPS API through CloudFront"
   git push
   ```
   The push redeploys the site, so the Download button now links to the new APK.
4. Install it on a phone from `<SITE_URL>/download` and check:
   - [ ] Sign in, the ledger and an SMS import all work.
   - [ ] An invite link `<SITE_URL>/j/<code>` opens straight in the app. Check with `adb shell pm get-app-links in.altus.app` (shows `verified`).
   - [ ] On Android 13+, the SMS permission isn't blocked as a "restricted setting". If it is: app info → ⋮ → **Allow restricted settings**. Mention this on the Download page if testers hit it.

---

## 10. Launch: fill the placeholders and open the site to Google

The production check refuses to publish a launch build while any `[PLACEHOLDER]` is left on a page.
Run this to list them:

```bash
PUBLIC_PRELAUNCH=1 SITE_URL=<SITE_URL> pnpm --filter @et/web run build   # warnings list every placeholder, page by page
```

Where to fill them:

| Placeholder | File |
|---|---|
| Founder quote, name, story, team, emails | `apps/web/src/pages/about.astro` |
| `[CONTACT EMAIL]`, `[SUPPORT EMAIL]`, `[PRESS EMAIL]` | `apps/web/src/data/site.ts` and the legal pages |
| `[PRICING]` | `src/pages/index.astro`, `src/data/faq.ts`, `src/pages/terms.md` |
| `[VERIFY]`, `[MONTH YEAR]` (competitor facts) | `src/pages/compare.astro`, `src/pages/index.astro`, `src/data/faq.ts` |
| `[AVAILABILITY…]`, `[PLAY STORE LINK]`, `[STATUS DATE]` | `src/pages/download.astro` |
| `[VERSION]`, `[DATE]`, `[APK SIZE]` | filled by `release:apk` (part 9.3) |
| `[LEGAL …]`, `[DATE]` on legal pages | `src/pages/privacy.md`, `terms.md`, `sms-policy.md`, `account-deletion.md` (after legal review) |

Then:

1. Get the legal pages and the naming of Splitwise reviewed (`[LEGAL CHECK]` markers). Budget 1–2 weeks.
2. GitHub → **Settings** → **Variables** → set `PUBLIC_PRELAUNCH` to `0`. Push any commit (or run
   **Deploy website**): robots now allows crawling and pages are indexable.
3. Google Search Console → **Add property** → **URL prefix** → `<SITE_URL>/` → verification method
   **HTML file**: download `google<token>.html`, put it in `apps/web/public/`, push, wait for the
   deploy, click **Verify**. Then **Sitemaps** → submit `sitemap.xml`.
4. Share `<SITE_URL>` and the QR codes. They all go through `/get`, which you can repoint any time.

---

## 11. Everyday: deploys, rollbacks, numbers

| Task | How |
|---|---|
| Change the website | Edit `apps/web`, open a PR (CI builds and checks it), merge to `main`: it deploys by itself. |
| Deploy by hand | Actions → **Deploy website** → **Run workflow**. |
| **Roll back the site** | Actions → **Deploy website** → **Run workflow** → paste the last good commit SHA → **Run**. Backstop: S3 keeps old file versions for 30 days. |
| Publish a new APK | Part 9.3. |
| **Roll back the APK** | `aws cloudfront-keyvaluestore put-key --kvs-arn <KVS_ARN> --if-match "$(aws cloudfront-keyvaluestore describe-key-value-store --kvs-arn <KVS_ARN> --query ETag --output text)" --key apk_latest --value /apk/altus-<previous>.apk` |
| Point `/get` at Play later | Same command, with the Play Store URL as the value. Printed QR codes keep working. |
| Waitlist size | On the server: `psql "$DATABASE_URL" -c "select count(*) from waitlist_entries;"` |
| Downloads and traffic | CloudFront console → **Reports & analytics** → **Popular objects** (APK downloads) and **Viewers**. |
| Origin logs (truncated IPs) | On the server: `sudo tail -f /var/log/nginx/altus-origin.log` |
| Update the infrastructure | Edit `infra/web/altus-web.yaml`, then create a **change set** first: `aws cloudformation deploy … --no-execute-changeset`, read it in the console, then execute. |
| Change the fonts | `apps/web/scripts/build-fonts.sh` (needs `pip install fonttools brotli`); bump the `v1` suffix in the script and in `src/styles/fonts.css`. |
| Preview the site locally | `SITE_URL=http://localhost:4321 pnpm --filter @et/web run dev` (the waitlist form talks to a local API on :4000). |

---

## 12. Later: switching off old app builds

Do this 2–4 weeks after the HTTPS build from part 9 is out, once testers have updated.

1. On the server, remove the old `/altus/` Nginx locations from the IP server block. Keep only a
   redirect so old invite links still open in a browser:
   ```nginx
   location ~ ^/altus/j/(?<code>[^/]+)$ { return 301 <SITE_URL>/j/$code; }
   ```
   then `sudo nginx -t && sudo systemctl reload nginx`.
2. Security group → **Inbound rules**: replace the port-80 rule for `0.0.0.0/0` with one whose source
   is the managed prefix list **`com.amazonaws.global.cloudfront.origin-facing`**.
   - The prefix list counts as about 55 rules toward the 60-rule limit, so keep only port 80 there (and 22 from your IP).
3. Old builds now fail to connect. Tell testers to install the latest APK from `<SITE_URL>/download`.

---

## 13. Before the Play Store: encrypt CloudFront to EC2

Visitors' connections to CloudFront are HTTPS. The hop from CloudFront to EC2 is still plain HTTP
on port 80. Until it's encrypted:

- On Google Play's **Data safety** form, answer **No** to "Is all of the user data collected by your app encrypted in transit?"
- Don't claim "encrypted in transit" or "end to end" anywhere (the privacy page doesn't).

**Fix (about half a day, about ₹1,000 a year):**

1. Buy a cheap domain (any registrar, or Route 53).
2. Add a DNS record `origin.<domain>` → **A** → `<ELASTIC_IP>`.
3. On the server, get a certificate with `sudo certbot --nginx -d origin.<domain>`, and add
   `origin.<domain>` to the `server_name` of the origin block (with `listen 443 ssl`).
4. Security group: allow **443** from the CloudFront prefix list. Ask AWS for a rules-per-group quota
   increase, or use a second security group, because the prefix list is large.
5. In `infra/web/altus-web.yaml`, on the `api` origin:
   - `DomainName: origin.<domain>`
   - `OriginProtocolPolicy: https-only`
   - add `OriginSSLProtocols: [TLSv1.2]`

   Deploy with a change set. The distribution is updated, not replaced, so the cloudfront.net address stays.
6. Re-test part 5.4, then answer **Yes** on Data safety.

---

## 14. Later: moving to your own domain

When you buy a public domain for the site (it can be the same one as in part 13):

1. Request an **ACM certificate in us-east-1** for `<domain>` and `www.<domain>` (DNS validation).
2. Add the domain names and the certificate to the **same** distribution (template:
   `Aliases` plus `ViewerCertificate` with the ACM ARN, `SslSupportMethod: sni-only`,
   `MinimumProtocolVersion: TLSv1.2_2021`). Create Route 53 alias records to the distribution.
3. Set the GitHub variable `SITE_URL=https://<domain>` and redeploy. Canonicals, the sitemap and the QR codes follow.
4. Add a 301 from the cloudfront.net host to the domain for **site pages and `/j/` only**. **Never
   redirect `/v1/*`**: old app builds POST there.
5. Set `PUBLIC_WEB_BASE_URL=https://<domain>` on the server. In the next app build:
   - change `API_BASE_URL` to the domain
   - add an App Link intent filter for the new host
6. Search Console: add a Domain property and resubmit the sitemap.

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `<SITE_URL>/v1/health` gives **502** | CloudFront can't reach EC2 | Security group port 80; `EC2_DNS` correct (part 2); `sudo nginx -t`. |
| `/v1/...` gives **403** with an Nginx page | Secret header mismatch | `/etc/nginx/altus-origin-secret.conf` must hold exactly the `OriginSecret` stack parameter. |
| App says "not signed in" through CloudFront but works on the IP | `Authorization` header not forwarded | The `/v1/*` behaviour must use the **AllViewerExceptHostHeader** origin request policy (it does in the template); check nobody changed it in the console. |
| Every user hits **429** together | Rate limits keyed on the proxy IP | The origin block must set `X-Forwarded-For $altus_viewer_ip`; `TRUST_PROXY` unset or `loopback`. |
| Pages show **403 AccessDenied** XML | The site isn't uploaded, or the page list is missing | Run **Deploy website**; check the "Publish the page list" step. |
| `/features` shows the 404 page | The page list is out of date | Redeploy (it rewrites the `routes` key). |
| Deploy fails at "Configure AWS credentials" | OIDC trust | The environment must be called exactly `production`; `GitHubRepo` stack parameter must match `owner/name`. |
| Build fails with "placeholders" | A launch build (`PUBLIC_PRELAUNCH=0`) with unfilled `[…]` | Fill them (part 10), or set `PUBLIC_PRELAUNCH=1`. |
| Invite links open the browser, not the app | App Link not verified | `assetlinks.json` SHA-256 must be the key that signed the installed APK; `adb shell pm verify-app-links --re-verify in.altus.app`. |
| Waitlist form says "Too many tries" | Rate limit (5 per minute per visitor) | Wait a minute; raise `RATE_LIMIT_WAITLIST_PER_MINUTE` in `api.env` if needed. |
| A change seems not to show | CloudFront cache | Pages revalidate within 5 minutes; the deploy also invalidates everything. Hard-refresh. |
