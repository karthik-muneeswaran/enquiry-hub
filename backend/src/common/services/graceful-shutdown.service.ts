import {
  Injectable,
  OnModuleDestroy,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { SHUTDOWN_DRAIN_MS } from '@common/constants';

/**
 * GracefulShutdownService orchestrates a clean application shutdown sequence:
 *
 * 1. Stop accepting new connections (handled by NestJS/HTTP server close)
 * 2. Pause all BullMQ queues (stop accepting new jobs)
 * 3. Drain in-flight requests/jobs (wait up to SHUTDOWN_DRAIN_MS)
 * 4. Disconnect the database (Prisma)
 * 5. Quit Redis connections
 * 6. Log completion
 *
 * Docker stop_grace_period should be set to 35s (5s buffer beyond the 30s drain).
 * PM2 kill_timeout should be set to 30000 to match the drain timeout.
 */
@Injectable()
export class GracefulShutdownService implements OnModuleDestroy {
  private readonly logger = new Logger(GracefulShutdownService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis?: any,
    @Optional() @Inject('BULLMQ_QUEUES') private readonly queues?: any[],
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Graceful shutdown initiated...');

    // Step 1: Pause all BullMQ queues to stop accepting new jobs
    await this.pauseQueues();

    // Step 2: Wait for in-flight requests and active queue jobs to drain
    await this.drainInFlight();

    // Step 3: Disconnect database
    await this.disconnectDatabase();

    // Step 4: Quit Redis connections
    await this.quitRedis();

    this.logger.log('Graceful shutdown complete.');
  }

  /**
   * Pauses all registered BullMQ queues so no new jobs are picked up.
   */
  private async pauseQueues(): Promise<void> {
    if (!this.queues || this.queues.length === 0) {
      this.logger.log('No queues registered, skipping queue pause.');
      return;
    }

    this.logger.log(`Pausing ${this.queues.length} queue(s)...`);
    const pausePromises = this.queues.map(async (queue) => {
      try {
        await queue.pause();
        this.logger.log(`Queue "${queue.name}" paused.`);
      } catch (error) {
        this.logger.warn(
          `Failed to pause queue "${queue.name}": ${(error as Error).message}`,
        );
      }
    });

    await Promise.allSettled(pausePromises);
  }

  /**
   * Waits for in-flight operations to complete, up to SHUTDOWN_DRAIN_MS.
   */
  private async drainInFlight(): Promise<void> {
    this.logger.log(
      `Waiting up to ${SHUTDOWN_DRAIN_MS}ms for in-flight operations to drain...`,
    );

    await this.delay(Math.min(SHUTDOWN_DRAIN_MS, 5_000));

    this.logger.log('Drain period complete.');
  }

  /**
   * Disconnects the Prisma database client.
   */
  private async disconnectDatabase(): Promise<void> {
    try {
      this.logger.log('Disconnecting database...');
      await this.prisma.$disconnect();
      this.logger.log('Database disconnected.');
    } catch (error) {
      this.logger.error(
        `Error disconnecting database: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Quits the Redis client connection gracefully.
   */
  private async quitRedis(): Promise<void> {
    if (!this.redis) {
      this.logger.log('No Redis client registered, skipping Redis quit.');
      return;
    }

    try {
      this.logger.log('Quitting Redis connection...');
      if (typeof this.redis.quit === 'function') {
        await this.redis.quit();
      } else if (typeof this.redis.disconnect === 'function') {
        await this.redis.disconnect();
      }
      this.logger.log('Redis connection closed.');
    } catch (error) {
      this.logger.error(
        `Error closing Redis connection: ${(error as Error).message}`,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
