import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Logger,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { Prisma, WebhookStatus } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrismaService } from '@database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '@queue/queue.constants';
import { RateLimit } from '@common/decorators';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { ListDlqJobsDto } from './dto';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface DlqJob {
  id: string;
  queueName: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string | undefined;
  attemptsMade: number;
  failedAt: number | undefined;
  timestamp: number;
}

interface PaginatedDlqResponse {
  data: DlqJob[];
  pagination: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasMore: boolean;
    totalCount: number;
    limit: number;
  };
}

@ApiTags('Admin')
@Controller('admin/queues')
@UseGuards(AdminAuthGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.CRM) private readonly crmQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH) private readonly pushQueue: Queue,
  ) {}

  /**
   * GET /admin/queues/stats
   * Returns queue statistics for all registered queues.
   */
  @Get('stats')
  @RateLimit({ limit: 60, window: 60, scope: 'ip' })
  @ApiOperation({ summary: 'Get queue statistics for all registered queues' })
  @ApiResponse({ status: 200, description: 'Queue statistics' })
  async getStats(): Promise<{ queues: QueueStats[] }> {
    const queues = [
      { name: 'email', queue: this.emailQueue },
      { name: 'push', queue: this.pushQueue },
      { name: 'crm', queue: this.crmQueue },
    ];

    const stats: QueueStats[] = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        const isPaused = await queue.isPaused();
        return {
          name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: isPaused,
        };
      }),
    );

    return { queues: stats };
  }

  /**
   * GET /admin/queues/dlq
   * Returns paginated dead-letter (failed) jobs with filtering, search, and sorting.
   */
  @Get('dlq')
  @RateLimit({ limit: 60, window: 60, scope: 'ip' })
  @ApiOperation({ summary: 'List dead-letter queue jobs with pagination and filtering' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Page size (max 100)' })
  @ApiQuery({ name: 'queueName', required: false, enum: ['email', 'push', 'crm'], description: 'Filter by queue' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['failedAt', 'attemptsMade'], description: 'Sort field' })
  @ApiQuery({ name: 'sortDir', required: false, enum: ['asc', 'desc'], description: 'Sort direction' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in error message and job data' })
  @ApiResponse({ status: 200, description: 'Paginated list of DLQ jobs' })
  async getDlqJobs(@Query() query: ListDlqJobsDto): Promise<PaginatedDlqResponse> {
    const { queueName, sortBy = 'failedAt', sortDir = 'desc', search, limit = 20, cursor } = query;

    // Determine which queues to query
    const queuesToQuery = this.getQueuesToQuery(queueName);

    // Fetch all failed jobs from relevant queues
    let allFailedJobs: DlqJob[] = [];
    for (const { name, queue } of queuesToQuery) {
      const failed = await queue.getFailed(0, -1);
      const mapped = failed.map((job: Job) => this.mapJobToDlqJob(job, name));
      allFailedJobs = allFailedJobs.concat(mapped);
    }

    // Apply search filter (ILIKE on error message and serialized job data)
    if (search) {
      const searchLower = search.toLowerCase();
      allFailedJobs = allFailedJobs.filter((job) => {
        const errorMatch = job.failedReason?.toLowerCase().includes(searchLower) ?? false;
        const dataMatch = JSON.stringify(job.data).toLowerCase().includes(searchLower);
        return errorMatch || dataMatch;
      });
    }

    // Sort jobs
    allFailedJobs.sort((a, b) => {
      let comparison: number;
      if (sortBy === 'attemptsMade') {
        comparison = a.attemptsMade - b.attemptsMade;
      } else {
        // Sort by failedAt (timestamp)
        const aTime = a.failedAt ?? 0;
        const bTime = b.failedAt ?? 0;
        comparison = aTime - bTime;
      }
      return sortDir === 'desc' ? -comparison : comparison;
    });

    const totalCount = allFailedJobs.length;

    // Apply cursor-based pagination
    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        startIndex = decoded.index ?? 0;
      } catch {
        startIndex = 0;
      }
    }

    const paginatedJobs = allFailedJobs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < totalCount;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ index: startIndex + limit })).toString('base64')
      : null;
    const previousCursor = startIndex > 0
      ? Buffer.from(JSON.stringify({ index: Math.max(0, startIndex - limit) })).toString('base64')
      : null;

    return {
      data: paginatedJobs,
      pagination: {
        nextCursor,
        previousCursor,
        hasMore,
        totalCount,
        limit,
      },
    };
  }

  /**
   * POST /admin/queues/:name/retry/:jobId
   * Retry a dead-letter job: update status + re-enqueue.
   */
  @Post(':name/retry/:jobId')
  @RateLimit({ limit: 30, window: 60, scope: 'ip' })
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

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job "${jobId}" not found in queue "${name}"`);
    }

    const jobData = job.data;

    // For CRM queue jobs with webhookEventId, wrap in transaction
    if (name === 'crm' && jobData.webhookEventId) {
      const newJob = await this.prisma.$transaction(
        async (tx) => {
          await tx.webhookEvent.update({
            where: { id: jobData.webhookEventId },
            data: {
              status: WebhookStatus.RECEIVED,
              error: null,
            },
          });

          await tx.auditLog.create({
            data: {
              entity: 'WebhookEvent',
              entityId: jobData.webhookEventId,
              action: 'UPDATE',
              before: { status: WebhookStatus.DEAD_LETTER } as unknown as Prisma.InputJsonValue,
              after: { status: WebhookStatus.RECEIVED, action: 'DLQ_RETRY' } as unknown as Prisma.InputJsonValue,
              performedBy: 'admin',
              requestId: `dlq-retry-${jobId}`,
            },
          });

          const enqueuedJob = await this.crmQueue.add(
            'process-webhook',
            jobData,
            {
              ...DEFAULT_JOB_OPTIONS,
              jobId: `crm-retry-${jobData.eventId}-${Date.now()}`,
            },
          );

          return enqueuedJob;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10000,
        },
      );

      await job.remove();

      this.logger.log(
        `DLQ job retried: queue=${name}, originalJobId=${jobId}, newJobId=${newJob.id}`,
      );

      return {
        message: `Job re-enqueued successfully in queue "${name}"`,
        newJobId: newJob.id ?? jobId,
      };
    }

    // For non-CRM queues, simply re-enqueue
    const newJob = await queue.add(job.name, jobData, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: `retry-${name}-${jobId}-${Date.now()}`,
    });

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
   * POST /admin/queues/:name/pause
   * Pause a queue.
   */
  @Post(':name/pause')
  @RateLimit({ limit: 30, window: 60, scope: 'ip' })
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiParam({ name: 'name', description: 'Queue name (crm, email, push)' })
  @ApiResponse({ status: 200, description: 'Queue paused' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async pauseQueue(
    @Param('name') name: string,
  ): Promise<{ message: string }> {
    const queue = this.getQueueByName(name);
    if (!queue) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }

    await queue.pause();

    this.logger.log(`Queue paused: ${name}`);

    return { message: `Queue "${name}" paused successfully` };
  }

  /**
   * POST /admin/queues/:name/resume
   * Resume a paused queue.
   */
  @Post(':name/resume')
  @RateLimit({ limit: 30, window: 60, scope: 'ip' })
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiParam({ name: 'name', description: 'Queue name (crm, email, push)' })
  @ApiResponse({ status: 200, description: 'Queue resumed' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async resumeQueue(
    @Param('name') name: string,
  ): Promise<{ message: string }> {
    const queue = this.getQueueByName(name);
    if (!queue) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }

    await queue.resume();

    this.logger.log(`Queue resumed: ${name}`);

    return { message: `Queue "${name}" resumed successfully` };
  }

  /**
   * Get BullMQ queue instance by name.
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

  /**
   * Determine which queues to query based on filter.
   */
  private getQueuesToQuery(
    queueName?: 'email' | 'push' | 'crm',
  ): Array<{ name: string; queue: Queue }> {
    if (queueName) {
      const queue = this.getQueueByName(queueName);
      return queue ? [{ name: queueName, queue }] : [];
    }
    return [
      { name: 'email', queue: this.emailQueue },
      { name: 'push', queue: this.pushQueue },
      { name: 'crm', queue: this.crmQueue },
    ];
  }

  /**
   * Map a BullMQ Job to a DlqJob response object.
   */
  private mapJobToDlqJob(job: Job, queueName: string): DlqJob {
    return {
      id: job.id ?? 'unknown',
      queueName,
      name: job.name,
      data: job.data as Record<string, unknown>,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      failedAt: job.finishedOn ?? undefined,
      timestamp: job.timestamp,
    };
  }
}
