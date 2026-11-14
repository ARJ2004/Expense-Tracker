import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type User } from '@prisma/client';
import { AccountsService } from '../accounts';
import { CategoriesService } from '../categories';
import { AppError, PrismaService } from '../common';
import { ImportsService } from '../imports';
import { IngestService } from '../ingest';
import type { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import type { MeDto } from './dto/me.dto';
import type { UpdateMeDto } from './dto/update-me.dto';
import { purgeOwnedData, type PurgeOwners } from './domain/purge-order';
import {
  USER_DELETED,
  USER_SIGNED_UP,
  type UserDeletedEvent,
  type UserSignedUpEvent,
} from './users.events';

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
    private readonly imports: ImportsService,
    private readonly ingest: IngestService,
    private readonly categories: CategoriesService,
    private readonly accounts: AccountsService,
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

  /** Users who have a monthly income set: they have a daily allowance even without budgets. */
  async idsWithIncome(): Promise<string[]> {
    const rows = await this.prisma.user.findMany({ where: { monthlyIncomePaise: { gt: 0 } }, select: { id: true } });
    return rows.map((r) => r.id);
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

  /** Updates whichever profile fields were sent. An empty patch returns the current profile unchanged. */
  async updateProfile(userId: string, dto: UpdateMeDto): Promise<MeDto> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.monthlyIncomePaise !== undefined) data.monthlyIncomePaise = BigInt(dto.monthlyIncomePaise);
    if (dto.incomeFrequency !== undefined) data.incomeFrequency = dto.incomeFrequency;
    if (Object.keys(data).length === 0) return this.getMe(userId);

    const { count } = await this.prisma.user.updateMany({ where: { id: userId }, data });
    if (count === 0) throw new AppError('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    return this.getMe(userId);
  }

  /**
   * Permanently removes the user and every row they own, in one transaction. Each owning module
   * deletes its own tables, in PURGE_ORDER, so the transactions → accounts RESTRICT foreign key
   * never blocks the purge; then the users row goes (refresh_tokens cascade from it). Idempotent:
   * a user already gone deletes nothing and still succeeds. Emits USER_DELETED after the commit.
   */
  async deleteAccount(userId: string): Promise<void> {
    const owners: PurgeOwners = { imports: this.imports, ledger: this.ingest, categories: this.categories, accounts: this.accounts };
    await this.prisma.$transaction(async (tx) => {
      await purgeOwnedData(owners, tx, userId);
      await tx.user.deleteMany({ where: { id: userId } });
    });
    this.events.emit(USER_DELETED, { userId } satisfies UserDeletedEvent);
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
