import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PrismaService } from '../common';
import { CATEGORY_DELETED, type CategoryDeletedEvent } from './categories.events';
import { CategoriesService } from './categories.service';

/** A prisma stand-in: the category is the user's own; the transaction fails when `failDelete` is set. */
function fakePrisma(failDelete: boolean): PrismaService {
  const tx = {
    category: {
      delete: () => (failDelete ? Promise.reject(new Error('delete failed')) : Promise.resolve({})),
    },
  };
  return {
    category: { findFirst: () => Promise.resolve({ id: 'c-1', userId: 'user-1' }) },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaService;
}

describe('CategoriesService.remove', () => {
  function setup(failDelete: boolean) {
    const events = new EventEmitter2();
    const order: string[] = [];
    events.on(CATEGORY_DELETED, ({ afterCommit }: CategoryDeletedEvent) => {
      order.push('listener');
      afterCommit(() => order.push('after-commit'));
    });
    return { service: new CategoriesService(fakePrisma(failDelete), events), order };
  }

  it('runs a listener’s afterCommit callback once the delete has committed', async () => {
    const { service, order } = setup(false);
    await service.remove('user-1', 'c-1');
    expect(order).toEqual(['listener', 'after-commit']);
  });

  it('never runs afterCommit callbacks when the delete rolls back', async () => {
    const { service, order } = setup(true);
    await expect(service.remove('user-1', 'c-1')).rejects.toThrow('delete failed');
    expect(order).toEqual(['listener']);
  });
});
