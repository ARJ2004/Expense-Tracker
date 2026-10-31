import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common';
import { UsersService } from '../users';
import type { AuthResponse } from './dto/auth.dto';
import { TokenService } from './token.service';
import { ID_TOKEN_VERIFIERS, type IdTokenVerifier } from './verifiers/id-token-verifier';

@Injectable()
export class AuthService {
  constructor(
    @Inject(ID_TOKEN_VERIFIERS) private readonly verifiers: IdTokenVerifier[],
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async signIn(idToken: string, deviceId: string): Promise<AuthResponse> {
    const verifier = this.verifiers.find((v) => v.accepts(idToken));
    if (!verifier) {
      throw new AppError('AUTH_INVALID_GOOGLE_TOKEN', 'Google sign-in could not be verified', HttpStatus.UNAUTHORIZED);
    }
    const profile = await verifier.verify(idToken);
    const user = await this.users.upsertFromGoogle(profile);
    return { ...(await this.tokens.issue(user.id, deviceId)), user };
  }

  async refresh(refreshToken: string, deviceId: string): Promise<AuthResponse> {
    const { userId, tokens } = await this.tokens.rotate(refreshToken, deviceId);
    return { ...tokens, user: await this.users.getMe(userId) };
  }

  logout(userId: string, refreshToken: string): Promise<void> {
    return this.tokens.revoke(userId, refreshToken);
  }
}
