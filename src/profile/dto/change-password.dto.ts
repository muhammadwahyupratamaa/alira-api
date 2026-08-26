import { ApiProperty } from '@nestjs/swagger';
import { Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true, minLength: 1, maxLength: 72 })
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ writeOnly: true, minLength: 8, maxLength: 72 })
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'newPassword must contain at least one letter and one number',
  })
  newPassword!: string;
}
