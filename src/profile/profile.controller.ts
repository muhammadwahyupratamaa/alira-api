import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthCookieService } from '../auth/auth-cookie.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PublicUser } from '../auth/types/public-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Access token or current password is invalid',
})
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ type: PublicUser })
  getProfile(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.profile.getProfile(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update currency and timezone preferences' })
  @ApiOkResponse({ type: PublicUser })
  @ApiBadRequestResponse({ description: 'Invalid or unsupported preference' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<PublicUser> {
    return this.profile.updatePreferences(user.id, dto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change password and revoke all refresh sessions' })
  @ApiNoContentResponse({
    description: 'Password changed and sessions revoked',
  })
  @ApiBadRequestResponse({
    description: 'New password is invalid or unchanged',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.profile.changePassword(user.id, dto);
    this.cookies.clearRefresh(response);
  }
}
