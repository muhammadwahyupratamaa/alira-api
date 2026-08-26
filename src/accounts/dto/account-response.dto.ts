import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '../../generated/prisma/enums';

export class AccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Main Bank' })
  name!: string;

  @ApiProperty({ enum: AccountType })
  type!: AccountType;

  @ApiProperty({ example: '1500000.00', type: String })
  initialBalance!: string;

  @ApiProperty({
    example: '1500000.00',
    description: 'Initial balance plus active income minus active expenses',
    type: String,
  })
  currentBalance!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
