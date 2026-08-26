import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { AppConfig } from '../config/app.config';
import { AuthConfig } from '../config/auth.config';

@Injectable()
export class AuthCookieService {
  private readonly appConfig: AppConfig;
  private readonly authConfig: AuthConfig;

  constructor(configService: ConfigService) {
    this.appConfig = configService.getOrThrow<AppConfig>('app');
    this.authConfig = configService.getOrThrow<AuthConfig>('auth');
  }

  get name(): string {
    return this.appConfig.refreshCookieName;
  }

  setRefresh(response: Response, token: string): void {
    response.cookie(this.name, token, this.options());
  }

  clearRefresh(response: Response): void {
    response.clearCookie(this.name, this.options());
  }

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.appConfig.cookieSecure,
      sameSite: this.appConfig.cookieSameSite,
      path: `/${this.appConfig.apiPrefix}/auth`,
      maxAge: this.authConfig.refreshTtlSeconds * 1000,
    };
  }
}
