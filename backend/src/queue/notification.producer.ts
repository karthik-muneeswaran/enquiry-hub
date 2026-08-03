import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from './queue.constants';

export interface EnqueueEmailData {
  to: string;
  enquiryId: string;
  name: string;
  propertyTitle: string;
}

export interface AdminNotificationData {
  enquiryId: string;
  name: string;
  email: string;
  propertyTitle: string;
}

export interface PushNotificationData {
  recipients: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
  eventId?: string;
}

@Injectable()
export class NotificationProducer {
  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH) private readonly pushQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CRM) private readonly crmQueue: Queue,
  ) {}

  /**
   * Enqueue a confirmation email for the enquiry submitter.
   */
  async enqueueConfirmationEmail(enquiry: {
    id: string;
    email: string;
    name: string;
    propertyTitle: string;
  }): Promise<Job> {
    return this.emailQueue.add(
      'confirmation',
      {
        type: 'confirmation',
        to: enquiry.email,
        enquiryId: enquiry.id,
        name: enquiry.name,
        propertyTitle: enquiry.propertyTitle,
      },
      DEFAULT_JOB_OPTIONS,
    );
  }

  /**
   * Enqueue an admin notification email about a new enquiry.
   */
  async enqueueAdminNotification(enquiry: {
    id: string;
    name: string;
    email: string;
    propertyTitle: string;
  }): Promise<Job> {
    return this.emailQueue.add(
      'admin-notification',
      {
        type: 'admin-notification',
        enquiryId: enquiry.id,
        name: enquiry.name,
        email: enquiry.email,
        propertyTitle: enquiry.propertyTitle,
      },
      DEFAULT_JOB_OPTIONS,
    );
  }

  /**
   * Enqueue a push notification job.
   */
  async enqueuePushNotification(data: PushNotificationData): Promise<Job> {
    return this.pushQueue.add('push-notification', data, DEFAULT_JOB_OPTIONS);
  }
}
