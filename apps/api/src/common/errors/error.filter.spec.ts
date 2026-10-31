import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { AppError } from './app-error';
import { ErrorFilter } from './error.filter';

describe('ErrorFilter', () => {
  const filter = new ErrorFilter();

  it('keeps the code and status of an AppError', () => {
    const { status, body } = filter.toResponse(new AppError('IMPORT_UNSUPPORTED_BANK', 'Unknown bank', 422));
    expect(status).toBe(422);
    expect(body).toEqual({ error: { code: 'IMPORT_UNSUPPORTED_BANK', message: 'Unknown bank' } });
  });

  it('maps Nest HTTP errors to a stable code', () => {
    expect(filter.toResponse(new NotFoundException('nope')).body.error.code).toBe('NOT_FOUND');
    const bad = filter.toResponse(new BadRequestException(['a is required', 'b must be a number']));
    expect(bad.body.error).toEqual({ code: 'VALIDATION_FAILED', message: 'a is required; b must be a number' });
  });

  it('hides details of unexpected errors', () => {
    const { status, body } = filter.toResponse(new Error('connection string leaked'));
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error.message).not.toContain('leaked');
  });
});
