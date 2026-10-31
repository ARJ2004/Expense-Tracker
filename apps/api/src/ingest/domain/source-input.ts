import { createHash } from 'node:crypto';
import type { Direction } from '@et/domain';

/**
 * Where a NormalizedTxn came from, with what makes it idempotent. Each source adds a variant
 * (SMS arrives in a later sprint with its own hash inputs).
 */
export type SourceInput =
  | { kind: 'manual'; clientRequestId: string }
  | {
      kind: 'statement';
      /** IST day "YYYY-MM-DD". */
      date: string;
      amountPaise: number;
      direction: Direction;
      narration: string;
      balancePaise?: number;
      /**
       * 1 for the first row in the file with these exact fields, 2 for the next identical one, …
       * Two genuine ₹486 Swiggy orders on one day stay two rows; re-uploading the file adds nothing.
       */
      nth: number;
    };

/** SHA-256 of the normalized raw input; re-sending the same input is a no-op. */
export function sourceHash(userId: string, input: SourceInput): string {
  return createHash('sha256').update(hashMaterial(userId, input)).digest('hex');
}

function hashMaterial(userId: string, input: SourceInput): string {
  switch (input.kind) {
    case 'manual':
      return `manual|${userId}|${input.clientRequestId.toLowerCase()}`;
    case 'statement': {
      const narration = input.narration.replace(/\s+/g, ' ').trim().toUpperCase();
      return ['statement', userId, input.date, input.amountPaise, input.direction, narration, input.balancePaise ?? '', input.nth].join('|');
    }
  }
}

/** Fields that make two rows of one file "identical" for the nth counter. */
export function statementRowKey(row: { date: string; amountPaise: number; direction: Direction; narration: string; balancePaise?: number }): string {
  return [row.date, row.amountPaise, row.direction, row.narration.replace(/\s+/g, ' ').trim().toUpperCase(), row.balancePaise ?? ''].join('|');
}
