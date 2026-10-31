import { HttpStatus } from '@nestjs/common';

/** A failure with a stable machine-readable code, returned as { error: { code, message } }. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message);
  }
}
