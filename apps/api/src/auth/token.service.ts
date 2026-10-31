import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppError, PrismaService } from '../common';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface AccessTokenPayload {
  sub: string;
}

const DAY_MS = 86_400_000;

/**
 * Issues access JWTs and rotating refresh tokens. Owns the refresh_tokens table.
 * Refresh tokens are 32 random bytes; only their SHA-256 hash is stored.
 */
@Injectable()
export class TokenService {
  private readonly accessTtl: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtl = config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
    this.refreshTtlMs = config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * DAY_MS;
  }

  /** Starts a new session (token family) for a device. */
  async issue(userId: string, deviceId: string): Promise<TokenPair> {
    const refreshToken = newRefreshToken();
    await this.prisma.refreshToken.create({
      data: { userId, deviceId, familyId: randomUUID(), tokenHash: hash(refreshToken), expiresAt: this.refreshExpiry() },
    });
    return { accessToken: await this.sign(userId), refreshToken, expiresIn: this.accessTtl };
  }

  /**
   * Swaps a refresh token for a new pair. A token that was already rotated or revoked means it
   * leaked: every session of that user is revoked.
   */
  async rotate(refreshToken: string, deviceId: string): Promise<{ userId: string; tokens: TokenPair }> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash(refreshToken) } });
    if (!row) throw refreshInvalid();
    if (row.revokedAt) await this.reuseDetected(row.userId);
    if (row.expiresAt <= new Date() || row.deviceId !== deviceId) throw refreshInvalid();

    const next = newRefreshToken();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Claim the old token atomically so two concurrent rotations can't both succeed.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({
        data: { userId: row.userId, deviceId, familyId: row.familyId, tokenHash: hash(next), expiresAt: this.refreshExpiry() },
      });
      return true;
    });
    if (!rotated) await this.reuseDetected(row.userId);

    return {
      userId: row.userId,
      tokens: { accessToken: await this.sign(row.userId), refreshToken: next, expiresIn: this.accessTtl },
    };
  }

  /** Signs out one device. Unknown tokens or another user's tokens are ignored. */
  async revoke(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash: hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token);
  }

  private sign(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId } satisfies AccessTokenPayload, { expiresIn: this.accessTtl });
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.refreshTtlMs);
  }

  private async reuseDetected(userId: string): Promise<never> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new AppError('AUTH_REFRESH_REUSED', 'Session ended, sign in again', HttpStatus.UNAUTHORIZED);
  }
}

function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function refreshInvalid(): AppError {
  return new AppError('AUTH_REFRESH_INVALID', 'Session expired, sign in again', HttpStatus.UNAUTHORIZED);
}
