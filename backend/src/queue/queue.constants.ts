/**
 * BullMQ queue name constants used throughout the application.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  PUSH: 'push-queue',
  CRM: 'crm-queue',
  MAINTENANCE: 'maintenance',
} as const;

/**
 * Default job options for queue jobs with retry configuration.
 * Retry: 3 attempts with exponential backoff (1s, 4s, 16s).
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 30 * 24 * 60 * 60, // 30 days
    count: 1000,
  },
  removeOnFail: false, // Keep failed jobs for DLQ inspection
};
