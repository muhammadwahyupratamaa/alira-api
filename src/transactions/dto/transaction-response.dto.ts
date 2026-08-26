import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, CategoryType } from '../../generated/prisma/enums';

export class TransactionAccountDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: AccountType }) type!: AccountType;
  @ApiProperty() isActive!: boolean;
}

export class TransactionCategoryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: CategoryType }) type!: CategoryType;
  @ApiPropertyOptional({ nullable: true }) icon!: string | null;
  @ApiPropertyOptional({ nullable: true }) color!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() isActive!: boolean;
}

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CategoryType }) type!: CategoryType;
  @ApiProperty({ example: '50000.00', type: String }) amount!: string;
  @ApiProperty({ example: '2026-08-26' }) transactionDate!: string;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deletedAt!: Date | null;
  @ApiProperty({ type: TransactionAccountDto })
  account!: TransactionAccountDto;
  @ApiProperty({ type: TransactionCategoryDto })
  category!: TransactionCategoryDto;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: TransactionResponseDto, isArray: true })
  data!: TransactionResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
