import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MetricsService } from './metrics.service';

const logger = new Logger('PrismaQueryLogging');

const SLOW_QUERY_THRESHOLD_MS = 500;

/**
 * Creates a Prisma middleware that:
 * 1. Measures query duration and records it in the db_query_duration_seconds histogram.
 * 2. Logs queries exceeding 500ms at warn level with query details and duration.
 *
 * Usage:
 *   prisma.$use(createPrismaQueryLoggingMiddleware(metricsService));
 */
export function createPrismaQueryLoggingMiddleware(
  metricsService: MetricsService,
): Prisma.Middleware {
  return async (
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<unknown>,
  ): Promise<unknown> => {
    const startTime = performance.now();

    const result = await next(params);

    const durationMs = performance.now() - startTime;
    const durationSeconds = durationMs / 1000;

    // Always record query duration in histogram
    metricsService.recordHistogram('db_query_duration_seconds', durationSeconds, {
      model: params.model ?? 'unknown',
      action: params.action,
    });

    // Log slow queries at warn level
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(
        `Slow query detected: ${params.model}.${params.action} took ${durationMs.toFixed(2)}ms`,
        {
          model: params.model,
          action: params.action,
          duration_ms: durationMs.toFixed(2),
          args: params.args ? JSON.stringify(params.args) : undefined,
        },
      );
    }

    return result;
  };
}
