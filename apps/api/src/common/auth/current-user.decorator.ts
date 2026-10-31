import { createParamDecorator, HttpStatus, type ExecutionContext } from '@nestjs/common';
import { AppError } from '../errors/app-error';

/** The signed-in caller, set on the request by JwtAuthGuard from a verified access token. */
export interface AuthUser {
  id: string;
}

/**
 * The only source of the caller's user id. Never read a user id from the body, query or path.
 * Throws if used on a route the guard skipped (a @Public() route).
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  if (!req.user) throw new AppError('AUTH_UNAUTHENTICATED', 'Sign in required', HttpStatus.UNAUTHORIZED);
  return req.user;
});
