import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { CategoryType } from '../../generated/prisma/enums';

const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  accountId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId!: string;

  @ApiProperty({ enum: CategoryType })
  @IsEnum(CategoryType)
  type!: CategoryType;

  @ApiProperty({ example: '50000.00', type: String })
  @IsString()
  @Matches(AMOUNT_PATTERN, {
    message:
      'amount must be a decimal string with at most 17 integer and 2 fractional digits',
  })
  amount!: string;

  @ApiPropertyOptional({ example: '2026-08-26', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'transactionDate must use YYYY-MM-DD' })
  transactionDate?: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed || null;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
