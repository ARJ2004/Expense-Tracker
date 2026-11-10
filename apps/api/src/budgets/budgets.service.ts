import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  addDays,
  BUDGET_LIMITS,
  budgetState,
  dailyAllowance,
  daysLeftInMonth,
  fixedReserve,
  istDateKey,
  istMonthKey,
  monthStartDay,
  paceOvershoot,
  projectedMonthSpend,
  shiftMonth,
  usedPercent,
} from '@et/domain';
import type { Budget } from '@prisma/client';
import { CategoriesService, type CategoryDto } from '../categories';
import { AppError, PrismaService } from '../common';
import { GoalsService } from '../goals';
import { LedgerStatsService } from '../ingest';
import { UsersService } from '../users';
import { BUDGET_SET, type BudgetSetEvent } from './budgets.events';
import type { AllowanceDto, BudgetDto, BudgetOverviewDto, SetBudgetDto } from './dto/budget.dto';

/** Spend in a category this month, before a given day and on it. */
interface CategoryBudgetSpend {
  budgetPaise: number;
  spentPaise: number;
}

/**
 * Owns budgets. Spend comes from ingest's LedgerStatsService, income from UsersService and what
 * goals hold back from GoalsService: budgets never read another module's tables.
 */
@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly stats: LedgerStatsService,
    private readonly users: UsersService,
    private readonly goals: GoalsService,
    private readonly categories: CategoriesService,
  ) {}

  /** Today in IST; a property so tests can move the clock. */
  today = (): string => istDateKey(new Date());

  async overview(userId: string, month: string = istMonthKey(new Date())): Promise<BudgetOverviewDto> {
    const today = this.today();
    const current = month === today.slice(0, 7);
    const through = current ? today : lastDay(month);
    const [budgets, categories, spend] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId } }),
      this.categories.list(userId),
      this.stats.spendByCategoryInDays(userId, monthStartDay(month), through),
    ]);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const items = budgets
      .filter((b) => byId.has(b.categoryId))
      .map((b) => toBudgetDto(b, byId.get(b.categoryId)!, spend.get(b.categoryId) ?? 0, month, current ? today : null))
      .sort((a, b) => Number(a.isFixed) - Number(b.isFixed) || b.usedPercent - a.usedPercent || b.spentPaise - a.spentPaise);
    const budgeted = new Set(budgets.map((b) => b.categoryId));
    let unbudgeted = 0;
    for (const [id, paise] of spend) if (!budgeted.has(id) && byId.get(id)?.isExpense !== false) unbudgeted += paise;
    return {
      month,
      items,
      totalBudgetPaise: items.reduce((s, i) => s + i.amountPaise, 0),
      totalSpentPaise: items.reduce((s, i) => s + i.spentPaise, 0),
      unbudgetedSpentPaise: unbudgeted,
      allowance: current ? await this.allowanceOn(userId, today) : null,
    };
  }

  /** Creates or changes the budget for one expense category. */
  async set(userId: string, categoryId: string, dto: SetBudgetDto): Promise<BudgetDto> {
    const category = await this.categories.assertUsable(userId, categoryId);
    if (!category.isExpense) throw new AppError('VALIDATION_FAILED', 'Budgets are for spending categories');
    const existing = await this.prisma.budget.findUnique({ where: { userId_categoryId: { userId, categoryId } } });
    if (!existing && (await this.prisma.budget.count({ where: { userId } })) >= BUDGET_LIMITS.maxBudgets) {
      throw new AppError('BUDGET_LIMIT', `You can set up to ${BUDGET_LIMITS.maxBudgets} budgets`, HttpStatus.CONFLICT);
    }
    const budget = await this.prisma.budget.upsert({
      where: { userId_categoryId: { userId, categoryId } },
      create: { userId, categoryId, amountPaise: BigInt(dto.amountPaise), isFixed: dto.isFixed ?? false },
      update: { amountPaise: BigInt(dto.amountPaise), ...(dto.isFixed !== undefined ? { isFixed: dto.isFixed } : {}) },
    });
    this.events.emit(BUDGET_SET, { userId, categoryId } satisfies BudgetSetEvent);
    const today = this.today();
    const month = today.slice(0, 7);
    const spend = await this.stats.spendByCategoryInDays(userId, monthStartDay(month), today);
    return toBudgetDto(budget, category, spend.get(categoryId) ?? 0, month, today);
  }

  async remove(userId: string, categoryId: string): Promise<void> {
    const { count } = await this.prisma.budget.deleteMany({ where: { userId, categoryId } });
    if (count === 0) throw new AppError('NOT_FOUND', 'Budget not found', HttpStatus.NOT_FOUND);
  }

  /** Everyone with a daily allowance: an income, or at least one budget. */
  async userIdsWithPlan(): Promise<string[]> {
    const [withIncome, withBudgets] = await Promise.all([
      this.users.idsWithIncome(),
      this.prisma.budget.findMany({ distinct: ['userId'], select: { userId: true } }),
    ]);
    return [...new Set([...withIncome, ...withBudgets.map((b) => b.userId)])];
  }

  /**
   * The daily allowance on an IST day, from spend before that day: today's for Home and the
   * morning push, a past day's when rewards closes it. Null without an income or any budget.
   */
  async allowanceOn(userId: string, day: string): Promise<AllowanceDto | null> {
    const month = day.slice(0, 7);
    const [budgets, me, goalReserve, before, onDay] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId } }),
      this.users.getMe(userId),
      this.goals.monthReserve(userId, month),
      this.stats.spendByCategoryInDays(userId, monthStartDay(month), addDays(day, -1)),
      this.stats.spendByCategoryInDays(userId, day, day),
    ]);
    const income = me.monthlyIncomePaise && me.monthlyIncomePaise > 0 ? me.monthlyIncomePaise : null;
    if (income === null && budgets.length === 0) return null;
    const base = income ?? budgets.reduce((s, b) => s + Number(b.amountPaise), 0);
    const fixedIds = new Set(budgets.filter((b) => b.isFixed).map((b) => b.categoryId));
    const lines = budgets.map((b) => ({
      budgetPaise: Number(b.amountPaise),
      spentPaise: (before.get(b.categoryId) ?? 0) + (onDay.get(b.categoryId) ?? 0),
      fixed: b.isFixed,
    }));
    const variable = (spend: Map<string, number>) => [...spend].reduce((s, [id, p]) => (fixedIds.has(id) ? s : s + p), 0);
    const daysLeft = daysLeftInMonth(month, day);
    const reserve = fixedReserve(lines);
    const a = dailyAllowance({
      basePaise: base,
      fixedReservePaise: reserve,
      goalReservePaise: goalReserve,
      variableSpentBeforeTodayPaise: variable(before),
      variableSpentTodayPaise: variable(onDay),
      daysLeft,
    });
    return {
      day,
      allowancePaise: a.allowancePaise,
      spentTodayPaise: a.spentTodayPaise,
      leftTodayPaise: a.leftTodayPaise,
      daysLeft,
      basis: income === null ? 'budgets' : 'income',
      fixedReservePaise: reserve,
      goalReservePaise: goalReserve,
    };
  }

  /** The budget and month-to-date spend (through today) for one category, or null without a budget. */
  async categoryThisMonth(userId: string, categoryId: string): Promise<(CategoryBudgetSpend & { categoryName: string }) | null> {
    const budget = await this.prisma.budget.findUnique({ where: { userId_categoryId: { userId, categoryId } }, include: { category: true } });
    if (!budget) return null;
    const today = this.today();
    const spend = await this.stats.spendByCategoryInDays(userId, monthStartDay(today.slice(0, 7)), today);
    return { budgetPaise: Number(budget.amountPaise), spentPaise: spend.get(categoryId) ?? 0, categoryName: budget.category.name };
  }

  /** Every budget with the month's spend, for a closed month (month-on-budget badge, weekly recap). */
  async monthResult(userId: string, month: string): Promise<{ budgetPaise: number; spentPaise: number } | null> {
    const overview = await this.overview(userId, month);
    if (overview.items.length === 0) return null;
    return { budgetPaise: overview.totalBudgetPaise, spentPaise: overview.totalSpentPaise };
  }
}

function lastDay(month: string): string {
  return addDays(monthStartDay(shiftMonth(month, 1)), -1);
}

function toBudgetDto(b: Budget, category: CategoryDto, spentPaise: number, month: string, today: string | null): BudgetDto {
  const amount = Number(b.amountPaise);
  return {
    category: { id: category.id, name: category.name, icon: category.icon, color: category.color },
    amountPaise: amount,
    isFixed: b.isFixed,
    spentPaise,
    usedPercent: usedPercent(spentPaise, amount),
    // A fixed cost paid in full is the plan working, not a warning.
    state: b.isFixed && spentPaise <= amount ? 'ok' : budgetState(spentPaise, amount),
    projectedPaise: today && !b.isFixed ? projectedMonthSpend(spentPaise, month, today) : null,
    overshootPaise: today && !b.isFixed ? paceOvershoot(spentPaise, amount, month, today) : 0,
  };
}
