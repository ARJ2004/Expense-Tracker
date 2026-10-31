import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';

export const PARSE_STATEMENT = 'parse-statement';

export interface ParseStatementJob {
  importId: string;
}

/**
 * pg-boss inside the app's own Postgres (schema "pgboss"): no extra infrastructure. Started on
 * first use, so tools that build the app without a database (OpenAPI emit) never connect.
 */
@Injectable()
export class ImportQueue implements OnApplicationShutdown {
  private readonly logger = new Logger(ImportQueue.name);
  private boss: PgBoss | null = null;
  private starting: Promise<PgBoss> | null = null;

  constructor(private readonly config: ConfigService) {}

  async send(job: ParseStatementJob): Promise<void> {
    const boss = await this.start();
    // A statement parses in seconds; a stuck job expires and is retried once.
    await boss.send(PARSE_STATEMENT, job, { expireInSeconds: 120, retryLimit: 1, retryDelay: 5 });
  }

  async work(handler: (job: ParseStatementJob) => Promise<void>): Promise<void> {
    const boss = await this.start();
    await boss.work<ParseStatementJob>(PARSE_STATEMENT, { pollingIntervalSeconds: 0.5 }, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    const boss = this.boss;
    this.boss = null;
    this.starting = null;
    if (boss) await boss.stop({ graceful: true, wait: true, timeout: 5_000 });
  }

  private start(): Promise<PgBoss> {
    this.starting ??= (async () => {
      const boss = new PgBoss({ connectionString: this.config.getOrThrow<string>('DATABASE_URL'), schema: 'pgboss', max: 3 });
      // Log the code only: job errors never carry file content, but keep the log small.
      boss.on('error', (e: Error) => this.logger.error(`pg-boss: ${e.message}`));
      await boss.start();
      await boss.createQueue(PARSE_STATEMENT);
      this.boss = boss;
      return boss;
    })();
    return this.starting;
  }
}
