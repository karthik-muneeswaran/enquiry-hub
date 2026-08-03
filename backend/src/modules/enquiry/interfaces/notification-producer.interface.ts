import { Enquiry } from '@prisma/client';

/**
 * Placeholder interface for NotificationProducer.
 * Will be implemented in the Notification module (task 5.1).
 */
export interface INotificationProducer {
  enqueueConfirmationEmail(enquiry: Enquiry): Promise<void>;
  enqueueAdminNotification(enquiry: Enquiry): Promise<void>;
}

export const NOTIFICATION_PRODUCER = 'NOTIFICATION_PRODUCER';
