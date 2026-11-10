import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';

/**
 * The one pg-boss instance, inside the app's own Postgres (schema "pgboss"): no extra
 * infrastructure. Started on first use, so tools that build the app without a database
 * (OpenAPI emit) never connect. Modules declare their own queue names and handlers.
 */
@Injectable()
export class JobQueue implements OnApplicationShutdown {
  private readonly logger = new Logger(JobQueue.name);
  private boss: PgBoss | null = null;
  private starting: Promise<PgBoss> | null = null;
  private readonly queues = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  async send(name: string, data: object, options: PgBoss.SendOptions = {}): Promise<void> {
    const boss = await this.queue(name);
    await boss.send(name, data, options);
  }

  async work<T extends object>(name: string, options: PgBoss.WorkOptions, handler: (data: T) => Promise<void>): Promise<void> {
    const boss = await this.queue(name);
    await boss.work<T>(name, options, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
  }

  /** A cron job in IST ("0 21 * * *" is 9 pm IST). Re-registering the same name replaces it. */
  async schedule(name: string, cron: string, data: object = {}): Promise<void> {
    const boss = await this.queue(name);
    await boss.schedule(name, cron, data, { tz: 'Asia/Kolkata' });
  }

  async onApplicationShutdown(): Promise<void> {
    const boss = this.boss;
    this.boss = null;
    this.starting = null;
    this.queues.clear();
    if (boss) await boss.stop({ graceful: true, wait: true, timeout: 5_000 });
  }

  private async queue(name: string): Promise<PgBoss> {
    const boss = await this.start();
    if (!this.queues.has(name)) {
      await boss.createQueue(name);
      this.queues.add(name);
    }
    return boss;
  }

  private start(): Promise<PgBoss> {
    this.starting ??= (async () => {
      const boss = new PgBoss({ connectionString: this.config.getOrThrow<string>('DATABASE_URL'), schema: 'pgboss', max: 3 });
      // Job errors never carry file content, SMS or tokens; log the message only.
      boss.on('error', (e: Error) => this.logger.error(`pg-boss: ${e.message}`));
      await boss.start();
      this.boss = boss;
      return boss;
    })();
    return this.starting;
  }
}
