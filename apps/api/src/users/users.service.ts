import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type User } from '@prisma/client';
import { AppError, PrismaService } from '../common';
import type { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import type { MeDto } from './dto/me.dto';
import { USER_SIGNED_UP, type UserSignedUpEvent } from './users.events';

/** A verified Google identity; `sub` is the stable key, email can change. */
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
}

/** Owns the users table. Other modules reach users only through this service. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Finds the user by Google `sub` (never by email) and refreshes their email and name, or creates them. */
  async upsertFromGoogle(profile: GoogleProfile): Promise<MeDto> {
    const existing = await this.prisma.user.findUnique({ where: { googleSub: profile.sub } });
    if (existing) {
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { email: profile.email, name: profile.name ?? existing.name },
      });
      return toMe(user);
    }
    try {
      const user = await this.prisma.user.create({
        data: { googleSub: profile.sub, email: profile.email, name: profile.name },
      });
      this.events.emit(USER_SIGNED_UP, { userId: user.id } satisfies UserSignedUpEvent);
      return toMe(user);
    } catch (e) {
      // Two first sign-ins raced; the other one created the row.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return toMe(await this.prisma.user.findUniqueOrThrow({ where: { googleSub: profile.sub } }));
      }
      throw e;
    }
  }

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    return toMe(user);
  }

  /** Saves the income answers and marks onboarding finished; only once per user. */
  async completeOnboarding(userId: string, dto: CompleteOnboardingDto): Promise<MeDto> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, onboardedAt: null },
      data: {
        monthlyIncomePaise: dto.monthlyIncomePaise === undefined ? null : BigInt(dto.monthlyIncomePaise),
        incomeFrequency: dto.incomeFrequency ?? null,
        onboardedAt: new Date(),
      },
    });
    if (count === 0) {
      await this.getMe(userId);
      throw new AppError('ALREADY_ONBOARDED', 'Onboarding is already finished', HttpStatus.CONFLICT);
    }
    return this.getMe(userId);
  }
}

function toMe(user: User): MeDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    monthlyIncomePaise: user.monthlyIncomePaise === null ? null : Number(user.monthlyIncomePaise),
    incomeFrequency: user.incomeFrequency,
    onboarded: user.onboardedAt !== null,
    currency: user.currency,
    timezone: user.timezone,
  };
}
