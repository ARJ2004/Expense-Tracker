import { ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import { isDayKey, isMonthKey } from '@et/domain';

/** A real calendar day as "YYYY-MM-DD". Use with @Validate(IsDayKey). */
@ValidatorConstraint({ name: 'isDayKey' })
export class IsDayKey implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isDayKey(value);
  }

  defaultMessage(): string {
    return '$property must be a date as YYYY-MM-DD';
  }
}

/** A calendar month as "YYYY-MM". Use with @Validate(IsMonthKey). */
@ValidatorConstraint({ name: 'isMonthKey' })
export class IsMonthKey implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isMonthKey(value);
  }

  defaultMessage(): string {
    return '$property must be a month as YYYY-MM';
  }
}
