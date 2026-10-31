import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OTHER_CATEGORY_ID } from '@et/domain';
import { CATEGORY_DELETED, type CategoryDeletedEvent } from '../../categories';
import { PrismaService } from '../../common';

/** A deleted custom category leaves its rows with no category (FK set null); file them under Other. */
@Injectable()
export class CategoryDeletedListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(CATEGORY_DELETED, { promisify: true })
  async moveToOther({ userId }: CategoryDeletedEvent): Promise<void> {
    await this.prisma.transaction.updateMany({
      where: { userId, categoryId: null },
      data: { categoryId: OTHER_CATEGORY_ID, categorySource: 'default' },
    });
  }
}
