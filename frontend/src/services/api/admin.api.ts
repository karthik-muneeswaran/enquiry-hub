import { apiClient } from './client';
import { PaginationMeta } from './types';

const ADMIN_HEADERS = {
  'X-Admin-Key': import.meta.env.VITE_ADMIN_API_KEY || 'admin-secret-key',
};

export interface QueueStats {
  queues: Array<{
    name: string;
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }>;
}

export interface DeadLetterJob {
  id: string;
  queueName: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: string;
}

export interface ListDlqJobsParams {
  cursor?: string;
  limit?: number;
  queueName?: string;
  search?: string;
  sortBy?: 'failedAt' | 'attemptsMade';
  sortDir?: 'asc' | 'desc';
}

interface DlqJobsResponse {
  data: DeadLetterJob[];
  pagination: PaginationMeta;
}

export const adminApi = {
  getQueueStats(): Promise<QueueStats> {
    return apiClient.get<QueueStats>('/admin/queues/stats', {
      headers: ADMIN_HEADERS,
    });
  },

  getDlqJobs(params?: ListDlqJobsParams): Promise<DlqJobsResponse> {
    return apiClient.get<DlqJobsResponse>('/admin/queues/dlq', {
      params,
      headers: ADMIN_HEADERS,
    });
  },

  retryJob(queueName: string, jobId: string): Promise<void> {
    return apiClient.post<void>(
      `/admin/queues/${queueName}/retry/${jobId}`,
      undefined,
      { headers: ADMIN_HEADERS },
    );
  },

  pauseQueue(queueName: string): Promise<void> {
    return apiClient.post<void>(
      `/admin/queues/${queueName}/pause`,
      undefined,
      { headers: ADMIN_HEADERS },
    );
  },

  resumeQueue(queueName: string): Promise<void> {
    return apiClient.post<void>(
      `/admin/queues/${queueName}/resume`,
      undefined,
      { headers: ADMIN_HEADERS },
    );
  },
};
