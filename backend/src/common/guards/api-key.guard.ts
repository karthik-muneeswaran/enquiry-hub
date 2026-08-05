import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '@config/config.service';
import { ApiErrorCode } from '@common/response';

/**
 * Guard that validates the X-API-Key header against configured active API keys.
 *
 * Supports multiple active API keys for key rotation without downtime.
 * Uses a Set for O(1) lookup of valid keys.
 *
 * Returns 403 Forbidden if:
 * - X-API-Key header is missing
 * - The provided key is not in the active keys set
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private activeKeys: Set<string>;

  constructor(private readonly configService: AppConfigService) {
    this.activeKeys = new Set(this.configService.apiKeys);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: ApiErrorCode.FORBIDDEN,
          message: 'Missing X-API-Key header',
        },
      });
    }

    if (!this.isValidKey(apiKey)) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: ApiErrorCode.FORBIDDEN,
          message: 'Invalid API key',
        },
      });
    }

    return true;
  }

  /**
   * Checks if the provided key is in the active keys set.
   * O(1) lookup via Set.
   */
  private isValidKey(key: string): boolean {
    return this.activeKeys.has(key);
  }

  /**
   * Refreshes the active keys set from configuration.
   * Useful if keys are updated at runtime.
   */
  refreshKeys(): void {
    this.activeKeys = new Set(this.configService.apiKeys);
  }
}
