import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, IS_PUBLIC_KEY, type AuthUser } from '../common';
import { TokenService } from './token.service';

/** Global guard: every route needs a valid access token unless it is marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthenticated();
    try {
      const payload = await this.tokens.verifyAccess(token);
      req.user = { id: payload.sub };
    } catch {
      throw unauthenticated();
    }
    return true;
  }
}

function unauthenticated(): AppError {
  return new AppError('AUTH_UNAUTHENTICATED', 'Sign in required', HttpStatus.UNAUTHORIZED);
}
