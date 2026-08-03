import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import { RATE_LIMIT_KEY, RateLimitConfig } from '../decorators/rate-limit.decorator';
import { REDIS_CLIENT } from '../../cache/cache.service';
import { ApiErrorCode } from '../response/api-error-codes.enum';
import { getRequestFromContext, getResponseFromContext } from '@common/utils';

/**
 * In-memory fallback entry for when Redis is unavailable.
 * Provides per-instance (non-distributed) rate limiting.
 */
interface InMemoryRateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly fallbackStore = new Map<string, InMemoryRateLimitEntry>();

  /** Timeout for Redis operations in milliseconds */
  private static readonly REDIS_TIMEOUT_MS = 2000;

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<RateLimitConfig | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RateLimit metadata → allow without rate limiting
    if (!config) {
      return true;
    }

    const request = getRequestFromContext(context);
    const response = getResponseFromContext(context);

    // If we can't get request/response (shouldn't happen), allow through
    if (!request || !response) {
      return true;
    }

    const identifier = this.extractIdentifier(config.scope, request);
    const endpoint = `${request.method}:${request.route?.path || request.path}`;
    const key = `ratelimit:${config.scope}:${identifier}:${endpoint}`;

    try {
      const result = await this.checkRateLimitRedis(key, config);
      this.setRateLimitHeaders(response, config, result.count);

      if (result.count > config.limit) {
        this.setRetryAfterHeader(response, config);
        throw new HttpException(
          {
            success: false,
            error: {
              code: ApiErrorCode.RATE_LIMITED,
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: 'Rate limit exceeded. Please try again later.',
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // If it's our own rate limit exception, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // Redis failure → fallback to in-memory
      this.logger.warn(
        `Redis rate limit check failed, using in-memory fallback: ${(error as Error).message}`,
      );
      return this.checkRateLimitInMemory(key, config, response);
    }
  }

  /**
   * Sliding window rate limiting using Redis sorted sets.
   *
   * Algorithm:
   * 1. Remove entries outside the current window
   * 2. Add the current request timestamp
   * 3. Count entries in the window
   * 4. Set TTL for auto-cleanup
   */
  private async checkRateLimitRedis(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ count: number }> {
    const now = Date.now();
    const windowStart = now - config.window * 1000;

    const results = await this.withTimeout(
      this.redis
        .multi()
        .zremrangebyscore(key, '-inf', windowStart.toString())
        .zadd(key, now.toString(), now.toString())
        .zcard(key)
        .expire(key, config.window)
        .exec(),
    );

    if (!results) {
      throw new Error('Redis MULTI returned null');
    }

    // results[2] is the ZCARD result: [error, count]
    const zcardResult = results[2];
    if (zcardResult[0]) {
      throw zcardResult[0] as Error;
    }

    const count = zcardResult[1] as number;
    return { count };
  }

  /**
   * In-memory fallback rate limiter (per-instance only, not distributed).
   * Uses a simple fixed-window counter approach.
   */
  private checkRateLimitInMemory(
    key: string,
    config: RateLimitConfig,
    response: Response,
  ): boolean {
    const now = Date.now();
    const entry = this.fallbackStore.get(key);

    if (!entry || now - entry.windowStart > config.window * 1000) {
      // Start a new window
      this.fallbackStore.set(key, { count: 1, windowStart: now });
      this.setRateLimitHeaders(response, config, 1);
      return true;
    }

    entry.count++;

    if (entry.count > config.limit) {
      this.setRateLimitHeaders(response, config, entry.count);
      this.setRetryAfterHeader(response, config);
      throw new HttpException(
        {
          success: false,
          error: {
            code: ApiErrorCode.RATE_LIMITED,
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded. Please try again later.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.setRateLimitHeaders(response, config, entry.count);
    return true;
  }

  /**
   * Extract the identifier used for rate limiting based on scope.
   */
  private extractIdentifier(scope: RateLimitConfig['scope'], request: Request): string {
    switch (scope) {
      case 'ip':
        return (
          (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          request.ip ||
          'unknown'
        );
      case 'apiKey':
        return (request.headers['x-api-key'] as string) || 'no-key';
      case 'user':
        return (request as any).user?.id || 'anonymous';
      default:
        return request.ip || 'unknown';
    }
  }

  /**
   * Set standard rate limit response headers.
   */
  private setRateLimitHeaders(
    response: Response,
    config: RateLimitConfig,
    currentCount: number,
  ): void {
    const remaining = Math.max(0, config.limit - currentCount);
    const resetTimestamp = Math.ceil((Date.now() + config.window * 1000) / 1000);

    response.setHeader('X-RateLimit-Limit', config.limit.toString());
    response.setHeader('X-RateLimit-Remaining', remaining.toString());
    response.setHeader('X-RateLimit-Reset', resetTimestamp.toString());
  }

  /**
   * Set the Retry-After header when rate limit is exceeded.
   */
  private setRetryAfterHeader(response: Response, config: RateLimitConfig): void {
    response.setHeader('Retry-After', config.window.toString());
  }

  /**
   * Wraps a Redis operation with a timeout to avoid hanging.
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Redis rate limit operation timed out'));
      }, RateLimitGuard.REDIS_TIMEOUT_MS);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
