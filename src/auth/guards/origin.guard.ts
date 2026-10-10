import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppConfig } from '../../config/app.config';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly frontendOrigin: string;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfig>('app');
    this.frontendOrigin = this.normalizeOrigin(config.frontendOrigin);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.get('origin');

    if (!origin || this.frontendOrigin !== this.normalizeOrigin(origin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }

    return true;
  }

  private normalizeOrigin(origin: string): string {
    try {
      return new URL(origin).origin;
    } catch {
      throw new ForbiddenException('Request origin is not allowed');
    }
  }
}
