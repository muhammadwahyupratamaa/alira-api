import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, CategoryType } from '../../generated/prisma/enums';

export class MetricComparisonDto {
  @ApiProperty({ type: String, example: '100000.00' }) previous!: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: '25.00' })
  percentageChange!: string | null;
}
export class DashboardSummaryDto {
  @ApiProperty() month!: number;
  @ApiProperty() year!: number;
  @ApiProperty({ type: String }) totalBalance!: string;
  @ApiProperty({ type: String }) monthlyIncome!: string;
  @ApiProperty({ type: String }) monthlyExpense!: string;
  @ApiProperty({ type: String }) netSaving!: string;
  @ApiProperty({ type: MetricComparisonDto })
  incomeComparison!: MetricComparisonDto;
  @ApiProperty({ type: MetricComparisonDto })
  expenseComparison!: MetricComparisonDto;
  @ApiProperty({ type: MetricComparisonDto })
  netSavingComparison!: MetricComparisonDto;
}
export class CategoryBreakdownItemDto {
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiPropertyOptional({ nullable: true }) color!: string | null;
  @ApiProperty({ type: String }) total!: string;
  @ApiProperty({ type: String, example: '50.00' }) percentage!: string;
}
export class CategoryBreakdownResponseDto {
  @ApiProperty() month!: number;
  @ApiProperty() year!: number;
  @ApiProperty({ enum: CategoryType }) type!: CategoryType;
  @ApiProperty({ type: String }) total!: string;
  @ApiProperty({ type: CategoryBreakdownItemDto, isArray: true })
  data!: CategoryBreakdownItemDto[];
}
export class RecentTransactionAccountDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: AccountType }) type!: AccountType;
}
export class RecentTransactionCategoryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiPropertyOptional({ nullable: true }) color!: string | null;
}
export class RecentTransactionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CategoryType }) type!: CategoryType;
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty({ example: '2026-08-26' }) transactionDate!: string;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: RecentTransactionAccountDto })
  account!: RecentTransactionAccountDto;
  @ApiProperty({ type: RecentTransactionCategoryDto })
  category!: RecentTransactionCategoryDto;
}
