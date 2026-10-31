import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * Prisma returns BIGINT columns (amounts in paise) as bigint, which JSON.stringify rejects.
 * Converts them to numbers; any real amount is far below Number.MAX_SAFE_INTEGER paise.
 */
export function bigintToNumber(value: unknown): unknown {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError('Amount exceeds the safe integer range');
    }
    return Number(value);
  }
  if (Array.isArray(value)) return value.map(bigintToNumber);
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bigintToNumber(v)]));
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(bigintToNumber));
  }
}
