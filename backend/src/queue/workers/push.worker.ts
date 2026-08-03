import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';

export interface PushJobData {
  recipients: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  eventId?: string;
}

@Processor(QUEUE_NAMES.PUSH)
export class PushWorker extends WorkerHost {
  private readonly logger = new Logger(PushWorker.name);

  async process(job: Job<PushJobData>): Promise<void> {
    const { recipients, title, body, data, eventId } = job.data;

    // Validate required data — permanent failure if missing
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new UnrecoverableError(
        'Missing or empty recipients array for push notification',
      );
    }

    if (!title || !body) {
      throw new UnrecoverableError(
        'Missing required fields: title and body are required for push notifications',
      );
    }

    // Record delivery timestamp
    const deliveredAt = new Date().toISOString();

    this.logger.log(
      `Push notification delivered: title="${title}", recipients=${recipients.length}, eventId=${eventId || 'N/A'}, deliveredAt=${deliveredAt}`,
    );

    // Log notification details for debugging
    this.logger.debug(
      `Push notification details: body="${body}", data=${JSON.stringify(data)}, recipients=${JSON.stringify(recipients)}`,
    );

    // TODO: Integrate actual push notification service (FCM, APNs, etc.)
    // For now, this is a placeholder that records the delivery.
  }
}
