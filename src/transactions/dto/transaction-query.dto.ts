import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoryType } from '../../generated/prisma/enums';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export enum TransactionSort {
  TRANSACTION_DATE_DESC = 'transactionDate:desc',
  TRANSACTION_DATE_ASC = 'transactionDate:asc',
  CREATED_AT_DESC = 'createdAt:desc',
  CREATED_AT_ASC = 'createdAt:asc',
  AMOUNT_DESC = 'amount:desc',
  AMOUNT_ASC = 'amount:asc',
}

export class TransactionQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @Matches(DATE_PATTERN)
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @Matches(DATE_PATTERN)
  endDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  accountId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ enum: CategoryType })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    enum: TransactionSort,
    default: TransactionSort.TRANSACTION_DATE_DESC,
  })
  @IsOptional()
  @IsEnum(TransactionSort)
  sort: TransactionSort = TransactionSort.TRANSACTION_DATE_DESC;
}
