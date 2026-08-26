import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType } from '../../generated/prisma/enums';

const integer = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class DashboardPeriodQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    description: 'Defaults to the current month in the user timezone',
  })
  @IsOptional()
  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
  @ApiPropertyOptional({
    minimum: 2000,
    maximum: 2100,
    description: 'Defaults to the current year in the user timezone',
  })
  @IsOptional()
  @Transform(integer)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Restrict results to an owned account',
  })
  @IsOptional()
  @IsUUID('4')
  accountId?: string;
}

export class CategoryBreakdownQueryDto extends DashboardPeriodQueryDto {
  @ApiPropertyOptional({ enum: CategoryType, default: CategoryType.EXPENSE })
  @IsOptional()
  @IsEnum(CategoryType)
  type: CategoryType = CategoryType.EXPENSE;
}

export class RecentTransactionsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5 })
  @IsOptional()
  @Transform(integer)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 5;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Restrict results to an owned account',
  })
  @IsOptional()
  @IsUUID('4')
  accountId?: string;
}
