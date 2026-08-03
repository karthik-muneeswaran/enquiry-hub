import { apiClient } from './api/client';
import { CreateEnquiryPayload } from './api/enquiry.api';

export interface QueuedSubmission {
  id: string;
  endpoint: string;
  data: CreateEnquiryPayload;
  timestamp: number;
}

export interface FlushResult {
  id: string;
  status: 'success' | 'error';
  error?: string;
}

const STORAGE_KEY = 'offline_submissions';

/**
 * localStorage-backed offline queue for enquiry submissions.
 * Enqueues submissions when the user is offline, and flushes them
 * to the API when connectivity is restored.
 */
export class OfflineQueue {
  /**
   * Add a submission to the offline queue.
   */
  enqueue(endpoint: string, data: CreateEnquiryPayload): void {
    const queue = this.getQueue();
    const item: QueuedSubmission = {
      id: crypto.randomUUID(),
      endpoint,
      data,
      timestamp: Date.now(),
    };
    queue.push(item);
    this.saveQueue(queue);
  }

  /**
   * Attempt to send all queued submissions to the API.
   * Successful items are removed; failed items remain in the queue.
   */
  async flush(): Promise<FlushResult[]> {
    const queue = this.getQueue();
    if (queue.length === 0) return [];

    const results: FlushResult[] = [];
    const remaining: QueuedSubmission[] = [];

    for (const item of queue) {
      try {
        await apiClient.post(item.endpoint, item.data);
        results.push({ id: item.id, status: 'success' });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({ id: item.id, status: 'error', error: message });
        remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    return results;
  }

  /**
   * Get all queued submissions.
   */
  getQueue(): QueuedSubmission[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  /**
   * Get the number of pending submissions in the queue.
   */
  getPendingCount(): number {
    return this.getQueue().length;
  }

  /**
   * Clear all items from the queue.
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveQueue(queue: QueuedSubmission[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }
}

/** Singleton instance used throughout the app. */
export const offlineQueue = new OfflineQueue();
