import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { AccountKind } from '@et/domain';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAccountDto {
  @ApiProperty({ example: 'HDFC Bank' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  bankName: string;

  @ApiProperty({ enum: Object.values(AccountKind), enumName: 'AccountKind' })
  @IsIn(Object.values(AccountKind))
  kind: AccountKind;

  /** Last 4 digits only; a full card or account number is rejected. */
  @ApiPropertyOptional({ example: '4821', pattern: '^\\d{4}$' })
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'maskedNumber must be exactly the last 4 digits' })
  maskedNumber?: string;

  @ApiPropertyOptional({ example: 'Salary account' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  nickname?: string;
}

export class AccountDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'HDFC Bank' })
  bankName: string;

  @ApiProperty({ enum: Object.values(AccountKind), enumName: 'AccountKind' })
  kind: AccountKind;

  @ApiProperty({ type: String, nullable: true, example: '4821' })
  maskedNumber: string | null;

  @ApiProperty({ type: String, nullable: true })
  nickname: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AccountListDto {
  @ApiProperty({ type: [AccountDto] })
  items: AccountDto[];
}
