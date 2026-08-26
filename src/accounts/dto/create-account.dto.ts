import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AccountType } from '../../generated/prisma/enums';

const BALANCE_PATTERN = /^(?:0|[1-9]\d{0,16})(?:\.\d{1,2})?$/;

export class CreateAccountDto {
  @ApiProperty({ example: 'Main Bank', maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: AccountType, example: AccountType.BANK })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({
    example: '1500000.00',
    description: 'Non-negative decimal string with at most two decimal places',
    type: String,
  })
  @IsString()
  @Matches(BALANCE_PATTERN, {
    message:
      'initialBalance must be a non-negative decimal string with at most 17 integer and 2 fractional digits',
  })
  initialBalance!: string;
}
