import { ApiProperty } from '@nestjs/swagger';

export class HealthResponse {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ example: 'ok', enum: ['ok'] })
  db: 'ok';

  @ApiProperty({ example: '0.0.1' })
  version: string;

  @ApiProperty({ example: '2026-11-02T09:00:00.000Z' })
  time: string;
}
