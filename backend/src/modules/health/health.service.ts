import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '@database/prisma.service';
import { REDIS_CLIENT } from '@cache/cache.service';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  components: {
    postgres: ComponentHealth;
    redis: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Check PostgreSQL connectivity via a simple query.
   */
  async checkPostgres(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Postgres health check failed: ${message}`);
      return { status: 'down', latencyMs: Date.now() - start, error: message };
    }
  }

  /**
   * Check Redis connectivity via PING.
   */
  async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const result = await this.redis.ping();
      if (result === 'PONG') {
        return { status: 'up', latencyMs: Date.now() - start };
      }
      return { status: 'down', latencyMs: Date.now() - start, error: `Unexpected ping response: ${result}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${message}`);
      return { status: 'down', latencyMs: Date.now() - start, error: message };
    }
  }

  /**
   * Run all health checks and aggregate results.
   * Returns overall 'healthy' only if all components are up.
   */
  async checkAll(): Promise<HealthCheckResult> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const allUp = postgres.status === 'up' && redis.status === 'up';

    return {
      status: allUp ? 'healthy' : 'unhealthy',
      components: { postgres, redis },
    };
  }
}
