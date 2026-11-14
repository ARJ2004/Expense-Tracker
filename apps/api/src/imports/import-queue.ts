import { Injectable } from '@nestjs/common';
import { JobQueue } from '../common';

export const PARSE_STATEMENT = 'parse-statement';

export interface ParseStatementJob {
  importId: string;
}

/** The "parse-statement" queue on the shared pg-boss JobQueue. */
@Injectable()
export class ImportQueue {
  constructor(private readonly jobs: JobQueue) {}

  async send(job: ParseStatementJob): Promise<void> {
    // A statement parses in seconds; a stuck job expires and is retried once.
    await this.jobs.send(PARSE_STATEMENT, job, { expireInSeconds: 120, retryLimit: 1, retryDelay: 5 });
  }

  async work(handler: (job: ParseStatementJob) => Promise<void>): Promise<void> {
    await this.jobs.work<ParseStatementJob>(PARSE_STATEMENT, { pollingIntervalSeconds: 0.5 }, handler);
  }
}
