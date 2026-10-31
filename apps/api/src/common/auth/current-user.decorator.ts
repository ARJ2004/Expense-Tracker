import { createParamDecorator, NotImplementedException } from '@nestjs/common';

/**
 * The only source of the caller's user id. Real implementation arrives with JwtAuthGuard in Sprint 2;
 * until then it throws so no endpoint can fall back to a user id from the request body.
 */
export const CurrentUser = createParamDecorator(() => {
  throw new NotImplementedException('CurrentUser requires JwtAuthGuard (Sprint 2)');
});
