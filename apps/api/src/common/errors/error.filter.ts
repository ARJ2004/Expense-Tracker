import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { reportError } from '../observability/sentry';
import { AppError } from './app-error';
import type { ErrorResponse } from './error-response.dto';

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Maps every thrown error to { error: { code, message } } and never leaks stack traces. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    // Raised-on-purpose AppErrors (e.g. DB_UNAVAILABLE) are expected; only unexpected 5xx get a stack trace.
    if (status >= 500 && !(exception instanceof AppError)) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      reportError(exception);
    }
    res.status(status).json(body);
  }

  toResponse(exception: unknown): { status: number; body: ErrorResponse } {
    if (exception instanceof AppError) {
      return { status: exception.status, body: { error: { code: exception.code, message: exception.message } } };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const raw = typeof payload === 'string' ? payload : (payload as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join('; ') : (raw ?? exception.message);
      return { status, body: { error: { code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR', message } } };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
    };
  }
}
