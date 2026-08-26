import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OriginGuard } from './guards/origin.guard';
import { AuthenticatedUser } from './types/authenticated-user.type';
import { AuthResponse, PublicUser } from './types/public-user.type';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiCreatedResponse({ description: 'User registered', type: PublicUser })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Log in and create a refresh session' })
  @ApiOkResponse({
    description: 'Authenticated; access token returned',
    type: AuthResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(dto, request.get('user-agent'));
    this.cookies.setRefresh(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Rotate a refresh session' })
  @ApiOkResponse({
    description: 'Session rotated; new access token returned',
    type: AuthResponse,
  })
  @ApiForbiddenResponse({ description: 'Origin is not allowed' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.refresh(
      this.getRefreshCookie(request),
      request.get('user-agent'),
    );
    this.cookies.setRefresh(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  @ApiForbiddenResponse({ description: 'Origin is not allowed' })
  @ApiUnauthorizedResponse({ description: 'Refresh token is invalid' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.getRefreshCookie(request));
    this.cookies.clearRefresh(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke every refresh session for the user' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  @ApiUnauthorizedResponse({ description: 'Access token is invalid' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.id);
    this.cookies.clearRefresh(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({
    description: 'Authenticated user profile',
    type: PublicUser,
  })
  @ApiUnauthorizedResponse({ description: 'Access token is invalid' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.authService.getMe(user.id);
  }

  private getRefreshCookie(request: Request): string {
    const value: unknown = request.cookies?.[this.cookies.name];
    if (typeof value !== 'string' || !value) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return value;
  }
}
