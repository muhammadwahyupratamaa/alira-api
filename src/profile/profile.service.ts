import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcrypt';
import { AuthConfig } from '../config/auth.config';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { PublicUser } from '../auth/types/public-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const BCRYPT_MAX_BYTES = 72;

@Injectable()
export class ProfileService {
  private readonly authConfig: AuthConfig;
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.safeProfile(user);
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<PublicUser> {
    const updated = await this.prisma.user.updateMany({
      where: { id: userId },
      data: dto,
    });
    if (updated.count !== 1) throw new UnauthorizedException();
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    this.assertPasswordByteLength(dto.currentPassword);
    this.assertPasswordByteLength(dto.newPassword);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is invalid');
    }
    if (await compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different');
    }
    const passwordHash = await hash(
      dto.newPassword,
      this.authConfig.bcryptRounds,
    );
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (updated.count !== 1) throw new UnauthorizedException();
      await transaction.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  private assertPasswordByteLength(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
      throw new BadRequestException('Password is too long');
    }
  }

  private safeProfile(user: {
    id: string;
    email: string;
    currency: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      currency: user.currency,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
