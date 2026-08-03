import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { Prisma, WebhookStatus } from '@prisma/client';
import CircuitBreaker = require('opossum');
import axios, { AxiosError } from 'axios';
import { PrismaService } from '@database/prisma.service';
import { QUEUE_NAMES } from '../queue.constants';

export interface CrmWebhookJobData {
  eventId: string;
  webhookEventId: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

@Injectable()
@Processor(QUEUE_NAMES.CRM)
export class CrmSyncWorker extends WorkerHost {
  private readonly logger = new Logger(CrmSyncWorker.name);
  private readonly crmBreaker: CircuitBreaker;
  private readonly crmWebhookUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super();

    this.crmWebhookUrl =
      this.configService.get<string>('CRM_WEBHOOK_URL') || '';

    // Create circuit breaker wrapping the CRM API delivery call
    this.crmBreaker = new CircuitBreaker(
      this.deliverToCrm.bind(this),
      {
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 5,
        rollingCountTimeout: 30000,
        name: 'crm',
      },
    );

    this.crmBreaker.on('open', () => {
      this.logger.warn(
        'CRM circuit breaker OPENED — webhook delivery will be retried after reset timeout',
      );
    });

    this.crmBreaker.on('halfOpen', () => {
      this.logger.log('CRM circuit breaker HALF-OPEN — probing CRM endpoint...');
    });

    this.crmBreaker.on('close', () => {
      this.logger.log('CRM circuit breaker CLOSED — normal operation resumed');
    });
  }

  /**
   * Process a CRM webhook job:
   * 1. Extract webhook event data from job
   * 2. Call CRM API through circuit breaker
   * 3. On success: wrap status update + audit_log in Prisma.$transaction (ReadCommitted)
   * 4. On failure: throw appropriate error for retry or DLQ
   */
  async process(job: Job<CrmWebhookJobData>): Promise<void> {
    const { eventId, webhookEventId, type, payload, receivedAt } = job.data;

    this.logger.log(
      `Processing CRM webhook job: eventId=${eventId}, type=${type}, attempt=${job.attemptsMade + 1}`,
    );

    // Validate required data — permanent failure if missing
    if (!webhookEventId || !eventId) {
      throw new UnrecoverableError(
        'Missing required job data: webhookEventId and eventId are required',
      );
    }

    try {
      // Call CRM API through circuit breaker
      await this.crmBreaker.fire(eventId, type, payload, receivedAt);
    } catch (error) {
      return this.handleCrmError(error as Error, job);
    }

    // Success — wrap status update + audit_log in transaction (ReadCommitted)
    await this.prisma.$transaction(
      async (tx) => {
        // Update WebhookEvent status to PROCESSED
        await tx.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: WebhookStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        // Insert AuditLog record
        await tx.auditLog.create({
          data: {
            entity: 'WebhookEvent',
            entityId: webhookEventId,
            action: 'PROCESS',
            before: Prisma.JsonNull,
            after: {
              eventId,
              type,
              payload,
              status: WebhookStatus.PROCESSED,
              processedAt: new Date().toISOString(),
            } as unknown as Prisma.InputJsonValue,
            performedBy: 'system',
            requestId: `crm-sync-${eventId}`,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    this.logger.log(
      `CRM webhook processed successfully: eventId=${eventId}, webhookEventId=${webhookEventId}`,
    );
  }

  /**
   * Handle CRM delivery errors:
   * - Circuit breaker OPEN: throw for retry
   * - Transient errors (5xx, timeouts, network): throw for retry
   * - Permanent errors (4xx except 429): throw UnrecoverableError → DLQ
   */
  private handleCrmError(error: Error, job: Job<CrmWebhookJobData>): never {
    const { eventId } = job.data;

    // Circuit breaker is open — retry later
    if (this.crmBreaker.opened) {
      this.logger.warn(
        `CRM circuit breaker OPEN for eventId=${eventId} — job will be retried`,
      );
      throw new Error(
        `CRM circuit breaker is OPEN — retry after reset timeout (eventId=${eventId})`,
      );
    }

    // Check if this is an Axios error with response details
    if (this.isAxiosError(error)) {
      const status = error.response?.status;

      // 429 Too Many Requests — transient, retry
      if (status === 429) {
        this.logger.warn(
          `CRM rate limited (429) for eventId=${eventId} — will retry`,
        );
        throw new Error(
          `CRM rate limited (429) for eventId=${eventId}`,
        );
      }

      // 4xx (except 429) — permanent failure, do not retry
      if (status && status >= 400 && status < 500) {
        this.logger.error(
          `CRM permanent failure (${status}) for eventId=${eventId}: ${error.message}`,
        );
        throw new UnrecoverableError(
          `CRM returned ${status} for eventId=${eventId}: ${error.message}`,
        );
      }

      // 5xx — transient, retry
      if (status && status >= 500) {
        this.logger.warn(
          `CRM server error (${status}) for eventId=${eventId} — will retry`,
        );
        throw new Error(
          `CRM server error (${status}) for eventId=${eventId}: ${error.message}`,
        );
      }
    }

    // Network error, timeout, or unknown — transient, retry
    this.logger.warn(
      `CRM delivery failed for eventId=${eventId}: ${error.message} — will retry`,
    );
    throw new Error(
      `CRM delivery failed for eventId=${eventId}: ${error.message}`,
    );
  }

  /**
   * BullMQ 'failed' event listener — called when a job fails.
   * When job exhausts all attempts, update WebhookEvent status to DEAD_LETTER.
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<CrmWebhookJobData>, error: Error): Promise<void> {
    const { eventId, webhookEventId } = job.data;
    const maxAttempts = job.opts?.attempts ?? 3;

    this.logger.warn(
      `CRM job failed: eventId=${eventId}, attempt=${job.attemptsMade}/${maxAttempts}, error=${error.message}`,
    );

    // If all retries exhausted → update to DEAD_LETTER
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `CRM job moved to DLQ: eventId=${eventId}, webhookEventId=${webhookEventId}`,
      );

      try {
        await this.prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: WebhookStatus.DEAD_LETTER,
            error: error.message.substring(0, 1000), // Truncate long error messages
            attemptCount: job.attemptsMade,
          },
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update WebhookEvent to DEAD_LETTER: webhookEventId=${webhookEventId}, error=${(updateError as Error).message}`,
        );
      }
    }
  }

  /**
   * BullMQ 'completed' event listener — for observability.
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<CrmWebhookJobData>): void {
    this.logger.log(
      `CRM job completed: eventId=${job.data.eventId}, attempts=${job.attemptsMade + 1}`,
    );
  }

  /**
   * Deliver webhook event payload to the CRM API.
   * This is the function wrapped by the circuit breaker.
   */
  private async deliverToCrm(
    eventId: string,
    type: string,
    payload: Record<string, unknown>,
    receivedAt: string,
  ): Promise<void> {
    if (!this.crmWebhookUrl) {
      // In development without CRM_WEBHOOK_URL configured, log and succeed
      this.logger.log(
        `[DEV] CRM delivery simulated for eventId=${eventId}, type=${type}`,
      );
      return;
    }

    await axios.post(
      this.crmWebhookUrl,
      {
        eventId,
        type,
        payload,
        receivedAt,
        deliveredAt: new Date().toISOString(),
      },
      {
        timeout: 9000, // Slightly less than circuit breaker timeout
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'enquiry-backend-platform',
        },
      },
    );
  }

  /**
   * Type guard for Axios errors.
   */
  private isAxiosError(error: unknown): error is AxiosError {
    return (
      error instanceof Error &&
      'isAxiosError' in error &&
      (error as AxiosError).isAxiosError === true
    );
  }
}
