import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type Account } from '@prisma/client';
import { AppError, PrismaService } from '../common';
import type { AccountDto, CreateAccountDto } from './dto/account.dto';

/** Owns the accounts table. Edit, delete and resolve() for ingest arrive in Sprint 3. */
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('ACCOUNT_EXISTS', 'This account is already added', HttpStatus.CONFLICT);
      }
      throw e;
    }
  }

  async list(userId: string): Promise<AccountDto[]> {
    const accounts = await this.prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return accounts.map(toDto);
  }
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
