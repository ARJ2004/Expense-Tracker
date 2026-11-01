import { ApiProperty } from '@nestjs/swagger';

/** Sources the Data sources screen lists. Notifications join in v0.3. */
export const LISTED_SOURCES = ['sms', 'statement', 'manual'] as const;
export type ListedSource = (typeof LISTED_SOURCES)[number];

export class SourceStatDto {
  @ApiProperty({ enum: LISTED_SOURCES, enumName: 'ListedSource' })
  kind: ListedSource;

  @ApiProperty({ type: 'integer', description: 'Live transactions with at least one source of this kind' })
  transactions: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When a source of this kind last reached the ledger' })
  lastAt: string | null;
}

export class SourceStatsDto {
  @ApiProperty({ type: [SourceStatDto], description: 'Every listed kind, in that order, zero when unused' })
  items: SourceStatDto[];
}
