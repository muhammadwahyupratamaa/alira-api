import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';

function IsIanaTimeZone(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isIanaTimeZone',
      validator: {
        validate: (value: unknown): boolean => {
          if (typeof value !== 'string') return false;
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage: (): string => 'timezone must be a valid IANA timezone',
      },
    },
    options,
  );
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: ['IDR'], example: 'IDR' })
  @IsOptional()
  @IsIn(['IDR'])
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Jakarta', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIanaTimeZone()
  timezone?: string;
}
