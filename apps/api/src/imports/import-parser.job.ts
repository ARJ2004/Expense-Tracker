import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ImportQueue } from './import-queue';
import { ImportsService } from './imports.service';

/** Runs queued "parse-statement" jobs: one uploaded file → staged rows ready for review. */
@Injectable()
export class ImportParserJob implements OnApplicationBootstrap {
  constructor(
    private readonly queue: ImportQueue,
    private readonly imports: ImportsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.work(async (job) => {
      await this.imports.parse(job.importId);
    });
  }
}
