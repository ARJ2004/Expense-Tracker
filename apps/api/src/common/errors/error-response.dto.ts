import { ApiProperty } from '@nestjs/swagger';

export class ErrorBody {
  @ApiProperty({ example: 'NOT_FOUND' })
  code: string;

  @ApiProperty({ example: 'Route GET /v1/nope not found' })
  message: string;
}

/** The single error shape every endpoint returns. */
export class ErrorResponse {
  @ApiProperty({ type: ErrorBody })
  error: ErrorBody;
}
