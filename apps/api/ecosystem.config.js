/**
 * PM2 process file for the API on EC2. See docs/deploy-ec2.md for the one-time server setup.
 *
 *   pm2 start apps/api/ecosystem.config.js --env production      # first start
 *   pm2 reload altus-api --update-env                             # after a new build
 *   pm2 deploy apps/api/ecosystem.config.js production            # pull, build, migrate, reload
 *
 * Secrets stay in apps/api/.env on the server (never in git). Node loads it with --env-file before
 * any code runs, so instrument.ts (Sentry) sees SENTRY_DSN too.
 */
const path = require('node:path');

/** Where `pm2 deploy` keeps releases on the server; the API's .env lives in its shared folder. */
const DEPLOY_PATH = process.env.ALTUS_DEPLOY_PATH || '/home/ubuntu/altus';

module.exports = {
  apps: [
    {
      name: 'altus-api',
      cwd: __dirname,
      script: 'dist/main.js',
      node_args: '--env-file=.env',
      // One process: the pg-boss import worker runs inside it, and a single EC2 instance gains
      // little from cluster mode. Raise instances only after moving the worker out.
      exec_mode: 'fork',
      instances: 1,
      // NestJS closes the HTTP server, pg-boss and Prisma on SIGINT (enableShutdownHooks).
      kill_timeout: 10000,
      max_memory_restart: '600M',
      exp_backoff_restart_delay: 200,
      // pino already writes JSON with timestamps; keep one stream per process.
      merge_logs: true,
      time: false,
      env: {},
      // Values here win over .env (Node's --env-file never overrides a variable that is already set).
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],

  deploy: {
    production: {
      user: process.env.ALTUS_DEPLOY_USER || 'ubuntu',
      host: process.env.ALTUS_DEPLOY_HOST ? [process.env.ALTUS_DEPLOY_HOST] : [],
      key: process.env.ALTUS_DEPLOY_KEY,
      ssh_options: ['StrictHostKeyChecking=accept-new'],
      ref: 'origin/main',
      repo: 'https://github.com/ARJ2004/Expense-Tracker.git',
      path: DEPLOY_PATH,
      'post-deploy': [
        // Each release is a fresh checkout: link the server's .env into it.
        `ln -sfn ${path.posix.join(DEPLOY_PATH, 'shared/api.env')} apps/api/.env`,
        'pnpm install --frozen-lockfile',
        'pnpm --filter "./packages/*" run build',
        'pnpm --filter @et/api run build',
        'pnpm --filter @et/api run prisma:deploy',
        'pm2 startOrReload apps/api/ecosystem.config.js --env production --update-env',
        'pm2 save',
      ].join(' && '),
    },
  },
};
