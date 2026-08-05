import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@database/prisma.service';
import { QUEUE_NAMES } from '../queue.constants';

/**
 * Data retention worker that runs nightly at 3am.
 *
 * Responsibilities:
 * - Archive enquiries older than 2 years (status → ARCHIVED)
 * - Delete processed webhook events older than 90 days
 * - Clean completed queue jobs older than 30 days
 */
@Processor(QUEUE_NAMES.MAINTENANCE)
export class RetentionWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RetentionWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.MAINTENANCE)
    private readonly maintenanceQueue: Queue,
  ) {
    super();
  }

  /**
   * Register the repeatable job on module initialization.
   * Cron: '0 3 * * *' — runs daily at 3:00 AM.
   */
  async onModuleInit(): Promise<void> {
    await this.maintenanceQueue.upsertJobScheduler(
      'data-retention',
      { pattern: '0 3 * * *' },
      {
        name: 'data-retention',
        opts: {
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10 },
          removeOnFail: { age: 30 * 24 * 60 * 60, count: 50 },
        },
      },
    );

    this.logger.log('Registered data-retention repeatable job (cron: 0 3 * * *)');
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Starting data retention job (id=${job.id})`);

    const archivedCount = await this.archiveOldEnquiries();
    const deletedWebhookCount = await this.deleteOldWebhookEvents();
    await this.cleanCompletedQueueJobs();

    this.logger.log(
      `Data retention job completed: ` +
        `archived=${archivedCount} enquiries, ` +
        `deleted=${deletedWebhookCount} webhook events`,
    );
  }

  /**
   * Archive enquiries older than 2 years (status → ARCHIVED).
   * Only archives enquiries that are not already archived.
   */
  private async archiveOldEnquiries(): Promise<number> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const result = await this.prisma.enquiry.updateMany({
      where: {
        createdAt: { lt: twoYearsAgo },
        status: { not: 'ARCHIVED' },
      },
      data: { status: 'ARCHIVED' },
    });

    this.logger.log(`Archived ${result.count} enquiries older than 2 years`);
    return result.count;
  }

  /**
   * Delete processed webhook events older than 90 days.
   */
  private async deleteOldWebhookEvents(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.prisma.webhookEvent.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        status: 'PROCESSED',
      },
    });

    this.logger.log(`Deleted ${result.count} processed webhook events older than 90 days`);
    return result.count;
  }

  /**
   * Clean completed queue jobs older than 30 days.
   * Uses BullMQ's built-in clean method on each queue.
   */
  private async cleanCompletedQueueJobs(): Promise<void> {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    try {
      const cleaned = await this.maintenanceQueue.clean(thirtyDaysMs, 100, 'completed');
      this.logger.log(
        `Cleaned ${cleaned.length} completed maintenance queue jobs older than 30 days`,
      );
    } catch (error) {
      this.logger.warn(`Failed to clean completed queue jobs: ${(error as Error).message}`);
    }
  }
}
