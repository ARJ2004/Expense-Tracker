import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common';
import { LISTED_SOURCES, type SourceStatDto } from './dto/source-stats.dto';

/** Per-source counts for the Data sources screen. Owned by ingest, which owns transaction_sources. */
@Injectable()
export class SourceStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One row per listed kind. A merged payment counts under each of its sources (it was seen by
   * both); a deleted transaction counts under none.
   */
  async forUser(userId: string): Promise<SourceStatDto[]> {
    const rows = await this.prisma.$queryRaw<{ kind: string; transactions: bigint; last_at: Date | null }[]>(Prisma.sql`
      SELECT s.source::text AS kind, COUNT(DISTINCT s.transaction_id) AS transactions, MAX(s.received_at) AS last_at
      FROM transaction_sources s
      JOIN transactions t ON t.id = s.transaction_id AND t.deleted_at IS NULL
      WHERE s.user_id = ${userId}::uuid
      GROUP BY s.source`);
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    return LISTED_SOURCES.map((kind) => {
      const row = byKind.get(kind);
      return { kind, transactions: Number(row?.transactions ?? 0), lastAt: row?.last_at?.toISOString() ?? null };
    });
  }
}
