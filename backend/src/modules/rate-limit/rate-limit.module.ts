import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

/**
 * RateLimitModule registers the RateLimitGuard as a global guard (APP_GUARD).
 * This means it applies to ALL routes, but only enforces limits on routes
 * that have the @RateLimit() decorator. Routes without the decorator are
 * allowed through without any rate limiting.
 *
 * The guard uses Redis sorted sets for a distributed sliding-window algorithm,
 * with an in-memory fallback when Redis is unavailable.
 */
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class RateLimitModule {}
