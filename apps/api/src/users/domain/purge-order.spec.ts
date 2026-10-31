import type { Prisma } from '@prisma/client';
import { PURGE_STEPS } from './purge-order';

/**
 * Records which table each step touches by driving the steps with a proxy tx whose every
 * delegate's deleteMany logs the table name.
 */
function runAndRecordTables(): string[] {
  const touched: string[] = [];
  const tx = new Proxy(
    {},
    {
      get: (_t, table: string) => ({
        deleteMany: () => {
          touched.push(table);
          return Promise.resolve({ count: 0 });
        },
      }),
    },
  ) as unknown as Prisma.TransactionClient;

  for (const step of PURGE_STEPS) void step(tx, 'user-1');
  return touched;
}

describe('purge-order', () => {
  const tables = runAndRecordTables();

  it('deletes transactions before accounts (the RESTRICT foreign key)', () => {
    expect(tables.indexOf('transaction')).toBeLessThan(tables.indexOf('account'));
  });

  it('deletes transaction sources and import rows before their parents', () => {
    expect(tables.indexOf('transactionSource')).toBeLessThan(tables.indexOf('transaction'));
    expect(tables.indexOf('importRow')).toBeLessThan(tables.indexOf('statementImport'));
  });

  it('deletes the user row last', () => {
    expect(tables[tables.length - 1]).toBe('user');
  });

  it('covers every owned table exactly once', () => {
    expect(tables).toEqual([
      'transactionSource',
      'importRow',
      'statementImport',
      'transaction',
      'merchantRule',
      'categoryCorrection',
      'category',
      'account',
      'refreshToken',
      'user',
    ]);
  });
});
