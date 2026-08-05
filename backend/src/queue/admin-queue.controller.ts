import { Controller, Post, Param, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, WebhookStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '@database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from './queue.constants';

@ApiTags('Admin')
@Controller({ path: 'admin/queues', version: '1' })
export class AdminQueueController {
  private readonly logger = new Logger(AdminQueueController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.CRM) private readonly crmQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH) private readonly pushQueue: Queue,
  ) {}

  /**
   * Retry a dead-letter job: update WebhookEvent status + re-enqueue in a transaction.
   * POST /admin/queues/:name/retry/:jobId
   */
  @Post(':name/retry/:jobId')
  @ApiOperation({ summary: 'Retry a dead-letter queue job' })
  @ApiParam({ name: 'name', description: 'Queue name (crm, email, push)' })
  @ApiParam({ name: 'jobId', description: 'Job ID to retry' })
  @ApiResponse({ status: 200, description: 'Job re-enqueued successfully' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async retryDlqJob(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
  ): Promise<{ message: string; newJobId: string }> {
    const queue = this.getQueueByName(name);
    if (!queue) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }

    // Find the failed job in the queue
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job "${jobId}" not found in queue "${name}"`);
    }

    const jobData = job.data;

    // For CRM queue jobs, wrap status update + re-enqueue in transaction
    if (name === 'crm' && jobData.webhookEventId) {
      const newJob = await this.prisma.$transaction(
        async (tx) => {
          // Reset WebhookEvent status from DEAD_LETTER back to RECEIVED
          await tx.webhookEvent.update({
            where: { id: jobData.webhookEventId },
            data: {
              status: WebhookStatus.RECEIVED,
              error: null,
            },
          });

          // Insert audit log for the retry action
          await tx.auditLog.create({
            data: {
              entity: 'WebhookEvent',
              entityId: jobData.webhookEventId,
              action: 'UPDATE',
              before: { status: WebhookStatus.DEAD_LETTER } as unknown as Prisma.InputJsonValue,
              after: {
                status: WebhookStatus.RECEIVED,
                action: 'DLQ_RETRY',
              } as unknown as Prisma.InputJsonValue,
              performedBy: 'admin',
              requestId: `dlq-retry-${jobId}`,
            },
          });

          // Re-enqueue with fresh retry options
          const enqueuedJob = await this.crmQueue.add('process-webhook', jobData, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `crm-retry-${jobData.eventId}-${Date.now()}`,
          });

          return enqueuedJob;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );

      this.logger.log(
        `DLQ job retried: queue=${name}, originalJobId=${jobId}, newJobId=${newJob.id}`,
      );

      // Remove the original failed job from the queue
      await job.remove();

      return {
        message: `Job re-enqueued successfully in queue "${name}"`,
        newJobId: newJob.id ?? jobId,
      };
    }

    // For non-CRM queues, simply re-enqueue the job with fresh options
    const newJob = await queue.add(job.name, jobData, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `retry-${name}-${jobId}-${Date.now()}`,
    });

    // Remove the original failed job
    await job.remove();

    this.logger.log(
      `DLQ job retried: queue=${name}, originalJobId=${jobId}, newJobId=${newJob.id}`,
    );

    return {
      message: `Job re-enqueued successfully in queue "${name}"`,
      newJobId: newJob.id ?? jobId,
    };
  }

  /**
   * Get the BullMQ queue instance by name.
   */
  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case 'crm':
        return this.crmQueue;
      case 'email':
        return this.emailQueue;
      case 'push':
        return this.pushQueue;
      default:
        return null;
    }
  }
}
