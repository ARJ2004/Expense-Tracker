import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type Account } from '@prisma/client';
import { AppError, PrismaService } from '../common';
import { normalizeAccountHint, type AccountHint } from './domain/account-hint';
import type { AccountDto, CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

/** Owns the accounts table. Other modules use assertOwned() and resolve(), never the table. */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    try {
      const account = await this.prisma.account.create({
        data: {
          userId,
          bankName: dto.bankName,
          kind: dto.kind,
          maskedNumber: dto.maskedNumber ?? null,
          nickname: dto.nickname ?? null,
        },
      });
      return toDto(account);
    } catch (e) {
      throw mapWriteError(e);
    }
  }

  async list(userId: string): Promise<AccountDto[]> {
    const accounts = await this.prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return accounts.map(toDto);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountDto> {
    await this.assertOwned(userId, id);
    try {
      return toDto(await this.prisma.account.update({ where: { id }, data: dto }));
    } catch (e) {
      throw mapWriteError(e);
    }
  }

  /** Refused with ACCOUNT_IN_USE while any transaction (even a deleted one) points at it. */
  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwned(userId, id);
    try {
      await this.prisma.account.delete({ where: { id } });
    } catch (e) {
      throw mapWriteError(e);
    }
  }

  /** The account if it belongs to the user, else 404 (never reveals another user's rows). */
  async assertOwned(userId: string, id: string): Promise<AccountDto> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } });
    if (!account) throw new AppError('NOT_FOUND', 'Account not found', HttpStatus.NOT_FOUND);
    return toDto(account);
  }

  /**
   * Finds the account a statement or SMS refers to by bank and last 4 (or a 3-digit suffix), or
   * creates it ("HDFC Bank ••1234") so an import never fails on an unknown account. With create: false it
   * only looks (statement import asks the user instead of adding accounts silently).
   *
   * Without 4 digits nothing is created and null means "account unknown": an unnumbered account
   * can't be told apart from the next one (and the unique index doesn't cover a null number), and
   * an unknown account is what lets dedup rule 3 merge the row with the statement that names it.
   */
  async resolve(userId: string, hint: AccountHint, options: { create?: boolean } = {}): Promise<AccountDto | null> {
    const key = normalizeAccountHint(hint);
    if (!key) return null;
    if (key.suffix3) {
      // "XX234": the one account of this bank whose last 4 end in 234; two candidates or none → unknown.
      const bySuffix = await this.prisma.account.findMany({
        where: { userId, bankName: { equals: key.bankName, mode: 'insensitive' }, maskedNumber: { endsWith: key.suffix3 } },
        take: 2,
      });
      return bySuffix.length === 1 ? toDto(bySuffix[0]!) : null;
    }
    if (!key.last4) return null;
    const existing = await this.prisma.account.findFirst({
      where: { userId, bankName: { equals: key.bankName, mode: 'insensitive' }, maskedNumber: key.last4 },
    });
    if (existing) return toDto(existing);
    if (options.create === false) return null;
    try {
      return toDto(
        await this.prisma.account.create({ data: { userId, bankName: key.bankName, kind: key.kind, maskedNumber: key.last4 } }),
      );
    } catch (e) {
      // Created concurrently by another import.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return toDto(await this.prisma.account.findFirstOrThrow({ where: { userId, bankName: key.bankName, maskedNumber: key.last4 } }));
      }
      throw e;
    }
  }
}

/** The RESTRICT foreign key from transactions; Prisma reports its violation (23001) without a code. */
const IN_USE_CONSTRAINT = 'transactions_account_id_fkey';

function mapWriteError(e: unknown): unknown {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return new AppError('ACCOUNT_EXISTS', 'This account is already added', HttpStatus.CONFLICT);
  }
  if (
    (e instanceof Prisma.PrismaClientUnknownRequestError || e instanceof Prisma.PrismaClientKnownRequestError) &&
    e.message.includes(IN_USE_CONSTRAINT)
  ) {
    return new AppError('ACCOUNT_IN_USE', 'This account has transactions', HttpStatus.CONFLICT);
  }
  return e;
}

function toDto(a: Account): AccountDto {
  return {
    id: a.id,
    bankName: a.bankName,
    kind: a.kind,
    maskedNumber: a.maskedNumber,
    nickname: a.nickname,
    createdAt: a.createdAt.toISOString(),
  };
}
