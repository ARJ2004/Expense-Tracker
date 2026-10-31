import { Catch, PayloadTooLargeException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorResponse } from '../common';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Multer's "File too large" becomes the contract's 413 FILE_TOO_LARGE. */
@Catch(PayloadTooLargeException)
export class FileTooLargeFilter implements ExceptionFilter {
  catch(_e: PayloadTooLargeException, host: ArgumentsHost): void {
    const body: ErrorResponse = { error: { code: 'FILE_TOO_LARGE', message: 'Statements up to 10 MB can be imported' } };
    host.switchToHttp().getResponse<Response>().status(413).json(body);
  }
}
