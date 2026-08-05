import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that restricts access to admin endpoints.
 * Validates the X-Admin-Key header against the configured admin key.
 *
 * In a production setup, this could be replaced with a proper
 * authentication strategy (JWT with admin role check, OAuth, etc.).
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly adminKey: string;

  constructor(private readonly configService: ConfigService) {
    this.adminKey = this.configService.get<string>('ADMIN_API_KEY', 'admin-secret-key');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-admin-key'] as string | undefined;

    if (!providedKey || providedKey !== this.adminKey) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required. Provide a valid X-Admin-Key header.',
        },
      });
    }

    return true;
  }
}
