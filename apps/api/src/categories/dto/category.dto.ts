import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryColor, type CategoryIcon } from '@et/domain';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Food & Dining' })
  name: string;

  @ApiProperty({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' })
  icon: CategoryIcon;

  @ApiProperty({ enum: CATEGORY_COLORS, enumName: 'CategoryColor', description: 'Theme palette key, not hex' })
  color: CategoryColor;

  @ApiProperty()
  isExpense: boolean;

  @ApiProperty({ description: 'System categories cannot be renamed or deleted' })
  system: boolean;
}

export class CategoryListDto {
  @ApiProperty({ type: [CategoryDto] })
  items: CategoryDto[];
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Pets' })
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name: string;

  @ApiProperty({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' })
  @IsIn(CATEGORY_ICONS)
  icon: CategoryIcon;

  @ApiProperty({ enum: CATEGORY_COLORS, enumName: 'CategoryColor' })
  @IsIn(CATEGORY_COLORS)
  color: CategoryColor;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isExpense?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name?: string;

  @ApiPropertyOptional({ enum: CATEGORY_ICONS, enumName: 'CategoryIcon' })
  @IsOptional()
  @IsIn(CATEGORY_ICONS)
  icon?: CategoryIcon;

  @ApiPropertyOptional({ enum: CATEGORY_COLORS, enumName: 'CategoryColor' })
  @IsOptional()
  @IsIn(CATEGORY_COLORS)
  color?: CategoryColor;
}
