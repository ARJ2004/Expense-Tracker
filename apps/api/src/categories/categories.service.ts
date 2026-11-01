import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Category } from '@prisma/client';
import { INCOME_CATEGORY_ID, OTHER_CATEGORY_ID, SYSTEM_CATEGORIES, type CategoryColor, type CategoryIcon, type Direction } from '@et/domain';
import { AppError, PrismaService } from '../common';
import { CATEGORY_DELETED, type CategoryDeletedEvent } from './categories.events';
import type { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const SYSTEM_NAMES = new Set(SYSTEM_CATEGORIES.map((c) => c.name.toLowerCase()));

/** Owns the categories table: 13 global system rows plus each user's custom ones. */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(userId: string): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toDto);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    if (SYSTEM_NAMES.has(dto.name.toLowerCase())) throw exists();
    try {
      const row = await this.prisma.category.create({
        data: { userId, name: dto.name, icon: dto.icon, color: dto.color, isExpense: dto.isExpense ?? true },
      });
      return toDto(row);
    } catch (e) {
      if (isUniqueViolation(e)) throw exists();
      throw e;
    }
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.ownCustom(userId, id);
    if (dto.name && SYSTEM_NAMES.has(dto.name.toLowerCase())) throw exists();
    try {
      return toDto(await this.prisma.category.update({ where: { id }, data: dto }));
    } catch (e) {
      if (isUniqueViolation(e)) throw exists();
      throw e;
    }
  }

  /** Deletes a custom category; in the same transaction its transactions move to Other (see CATEGORY_DELETED). */
  async remove(userId: string, id: string): Promise<void> {
    await this.ownCustom(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await this.events.emitAsync(CATEGORY_DELETED, { userId, categoryId: id, tx } satisfies CategoryDeletedEvent);
      await tx.category.delete({ where: { id } });
    });
  }

  /** The category if the user may file a transaction under it (system or their own), else 404. */
  async assertUsable(userId: string, id: string): Promise<CategoryDto> {
    const row = await this.prisma.category.findFirst({ where: { id, OR: [{ userId: null }, { userId }] } });
    if (!row) throw notFound();
    return toDto(row);
  }

  /** Where a transaction goes when no rule matched: Income for credits, Other for debits. */
  fallbackFor(direction: Direction): string {
    return direction === 'credit' ? INCOME_CATEGORY_ID : OTHER_CATEGORY_ID;
  }

  private async ownCustom(userId: string, id: string): Promise<Category> {
    const row = await this.prisma.category.findFirst({ where: { id, OR: [{ userId: null }, { userId }] } });
    if (!row) throw notFound();
    if (row.userId === null) {
      throw new AppError('CATEGORY_SYSTEM', 'System categories cannot be changed', HttpStatus.FORBIDDEN);
    }
    return row;
  }
}

export function toCategoryDto(row: Category): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as CategoryIcon,
    color: row.color as CategoryColor,
    isExpense: row.isExpense,
    system: row.userId === null,
  };
}

const toDto = toCategoryDto;

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

function exists(): AppError {
  return new AppError('CATEGORY_EXISTS', 'A category with this name already exists', HttpStatus.CONFLICT);
}

function notFound(): AppError {
  return new AppError('NOT_FOUND', 'Category not found', HttpStatus.NOT_FOUND);
}
