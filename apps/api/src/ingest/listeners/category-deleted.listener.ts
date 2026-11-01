import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CATEGORY_DELETED, type CategoryDeletedEvent } from '../../categories';
import { IngestService } from '../ingest.service';

/** A custom category is being deleted: its transactions move to Other, in the delete's transaction. */
@Injectable()
export class CategoryDeletedListener {
  constructor(private readonly ingest: IngestService) {}

  // suppressErrors: false, so a failed move rolls the delete back instead of being logged and lost.
  @OnEvent(CATEGORY_DELETED, { promisify: true, suppressErrors: false })
  async moveToOther({ userId, categoryId, tx, afterCommit }: CategoryDeletedEvent): Promise<void> {
    const moved = await this.ingest.moveOutOfCategory(userId, categoryId, tx);
    if (moved.length > 0) afterCommit(() => this.ingest.announceRecategorized(userId, moved));
  }
}
