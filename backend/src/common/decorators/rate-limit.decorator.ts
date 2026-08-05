import { SetMetadata } from '@nestjs/common';

export interface RateLimitConfig {
  limit: number;
  window: number;
  scope: 'ip' | 'apiKey' | 'user';
}

export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Custom decorator that attaches rate limit configuration metadata to a route.
 * The RateLimitGuard reads this metadata at runtime and applies the
 * sliding-window algorithm per scope.
 */
export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);
