import { ApiProperty } from '@nestjs/swagger';

export class PublicUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty({ example: 'IDR' })
  currency!: string;

  @ApiProperty({ example: 'Asia/Jakarta' })
  timezone!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

export class AuthResponse {
  @ApiProperty({ description: 'Short-lived JWT access token' })
  accessToken!: string;

  @ApiProperty({ type: PublicUser })
  user!: PublicUser;
}
