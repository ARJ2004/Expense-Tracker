# Deploying the API to EC2 with PM2

The API runs on EC2 as one Node.js process managed by PM2, defined in
[`apps/api/ecosystem.config.js`](../apps/api/ecosystem.config.js). PM2 restarts it if it crashes,
starts it again after a reboot, and reloads it after each deploy.

## One-time server setup

On the EC2 instance (Ubuntu), as the `ubuntu` user:

1. Install Node.js 22.13 or later, pnpm and PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   sudo corepack enable
   sudo npm install -g pm2
   ```
2. Let `pm2 deploy` create its folders (`/home/ubuntu/altus/source`, `current` and `shared`). Run this
   from your Mac:
   ```bash
   ALTUS_DEPLOY_HOST=<ec2 public ip> ALTUS_DEPLOY_KEY=<path to the .pem> \
     pm2 deploy apps/api/ecosystem.config.js production setup
   ```
3. On the server, create the API's environment file at `/home/ubuntu/altus/shared/api.env`. Start
   from `apps/api/.env.example` and set at least:
   ```properties
   PORT=4000
   DATABASE_URL=postgresql://<user>:<url-encoded password>@localhost:5432/expense-tracker
   GOOGLE_WEB_CLIENT_ID=<the Altus Web client ID>
   JWT_ACCESS_SECRET=<openssl rand -base64 48>
   DEV_AUTH_ENABLED=false
   ```
   `NODE_ENV=production` comes from the ecosystem file. The API **refuses to start** in production if
   `DEV_AUTH_ENABLED` is true or `GOOGLE_WEB_CLIENT_ID` is missing. Lock the file down:
   `chmod 600 /home/ubuntu/altus/shared/api.env`.

   **Push notifications (optional).** Without a key the API runs normally and every notification
   still lands in the app's inbox; phones just don't buzz. To turn push on, download a
   service-account key from Firebase (Project settings → Service accounts → Generate new private
   key) and add it to `api.env` base64-encoded on one line, never in git:
   ```bash
   echo "FIREBASE_SERVICE_ACCOUNT_BASE64=$(base64 -w0 firebase-key.json)" >> /home/ubuntu/altus/shared/api.env
   rm firebase-key.json
   ```
   The app side needs that project's `google-services.json` in `apps/mobile/android/app/` (gitignored)
   before building the APK.
4. Make PM2 start on boot and rotate its logs:
   ```bash
   pm2 startup systemd -u ubuntu --hp /home/ubuntu   # then run the sudo command it prints
   pm2 install pm2-logrotate
   ```

## Deploying

From your Mac, after pushing to `main`:

```bash
ALTUS_DEPLOY_HOST=<ec2 public ip> ALTUS_DEPLOY_KEY=<path to the .pem> \
  pm2 deploy apps/api/ecosystem.config.js production
```

This logs in over SSH, pulls `origin/main`, links `shared/api.env` into `apps/api/.env`, installs
dependencies, builds the shared packages and the API, applies database migrations, and reloads the
process. `ALTUS_DEPLOY_USER` (default `ubuntu`) and `ALTUS_DEPLOY_PATH` (default `/home/ubuntu/altus`)
change the defaults.

To deploy by hand on the server instead:

```bash
cd /home/ubuntu/altus/current && git pull
pnpm install --frozen-lockfile && pnpm --filter "./packages/*" run build && pnpm --filter @et/api run build
pnpm --filter @et/api run prisma:deploy
pm2 startOrReload apps/api/ecosystem.config.js --env production --update-env
```

## Everyday commands on the server

```bash
pm2 status                  # is altus-api online, how many restarts
pm2 logs altus-api          # live logs (JSON from pino: route, status, latency; never bodies)
pm2 reload altus-api        # restart without dropping the process
pm2 monit                   # CPU and memory
```

## Before the app can use it

- **HTTPS.** Release builds only talk to an HTTPS URL. Put Nginx or Caddy in front on ports 80/443
  with a certificate for your domain, proxying to `localhost:4000`, then set `API_BASE_URL` in
  `apps/mobile/src/lib/config.ts`.
- **Security group.** Open 443 (and 80 for the certificate check). Don't open 4000 or 5432 to the
  internet.
- **Backups.** Schedule `infra/backup/pg-backup.sh` with cron; see `infra/backup/README.md`.

## Settings in the ecosystem file

| Setting | Why |
|---------|-----|
| `--env-file=.env` | Loads secrets before any code runs, so Sentry (`instrument.ts`) sees `SENTRY_DSN` |
| One instance, fork mode | The pg-boss workers run inside the API process: statement parsing, closing each day for streaks (08:30 IST) and the scheduled notifications (9 am, 8 pm, 9 pm, Sunday 6 pm IST). A second instance would need `SCHEDULES_ENABLED=false` |
| `kill_timeout: 10000` | Gives NestJS time to close the HTTP server, pg-boss and Prisma cleanly |
| `max_memory_restart: 600M` | Restarts the process if a large PDF import pushes memory too high |
