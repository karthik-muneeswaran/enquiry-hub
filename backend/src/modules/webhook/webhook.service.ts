import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, WebhookEvent } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '@queue/queue.constants';
import { WebhookRepository, PaginatedResult } from './webhook.repository';
import { WebhookPayloadDto, ListWebhookEventsDto } from './dto';

export interface ProcessEventResult {
  event: WebhookEvent;
  isDuplicate: boolean;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookRepository: WebhookRepository,
    @InjectQueue(QUEUE_NAMES.CRM) private readonly crmQueue: Queue,
  ) {}

  /**
   * Process an incoming webhook event:
   * 1. Check eventId deduplication → if exists, return existing record (duplicate)
   * 2. Create WebhookEvent with status RECEIVED
   * 3. Enqueue to CRM queue for async processing
   */
  async processEvent(dto: WebhookPayloadDto): Promise<ProcessEventResult> {
    // 1. Deduplication check — return existing if already processed
    const existing = await this.webhookRepository.findByEventId(dto.eventId);
    if (existing) {
      this.logger.log(
        `Duplicate webhook eventId detected: ${dto.eventId}, returning existing record`,
      );
      return { event: existing, isDuplicate: true };
    }

    // 2. Create WebhookEvent with RECEIVED status
    const webhookEvent = await this.webhookRepository.create({
      eventId: dto.eventId,
      type: dto.type,
      source: dto.source,
      payload: dto.payload as unknown as Prisma.InputJsonValue,
      status: 'RECEIVED',
      enquiry: dto.enquiryId
        ? { connect: { id: dto.enquiryId } }
        : undefined,
    });

    // 3. Enqueue to CRM queue for asynchronous processing
    try {
      await this.crmQueue.add(
        'process-webhook',
        {
          eventId: webhookEvent.eventId,
          webhookEventId: webhookEvent.id,
          type: webhookEvent.type,
          payload: webhookEvent.payload,
          receivedAt: webhookEvent.createdAt.toISOString(),
        },
        {
          ...DEFAULT_JOB_OPTIONS,
          jobId: `crm-${webhookEvent.eventId}`,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue webhook event ${webhookEvent.id} to CRM queue: ${(error as Error).message}`,
      );
      // The event is persisted with RECEIVED status even if queue is down.
      // It can be reprocessed later when Redis/queue recovers.
    }

    return { event: webhookEvent, isDuplicate: false };
  }

  /**
   * Find all webhook events with cursor pagination, filtering, and sorting.
   */
  async findAll(
    params: ListWebhookEventsDto,
  ): Promise<PaginatedResult<WebhookEvent>> {
    return this.webhookRepository.findWithCursor(params);
  }
}
