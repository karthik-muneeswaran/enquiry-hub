import { apiClient } from './client';
import { PaginatedResponse } from './types';

export interface WebhookEvent {
  id: string;
  eventId: string;
  source: string;
  type: string;
  payload: unknown;
  status: string;
  retryCount: number;
  processedAt: string | null;
  errorMessage: string | null;
  enquiryId: string | null;
  createdAt: string;
}

export interface ListWebhookEventsParams {
  cursor?: string;
  limit?: number;
  status?: string;
  type?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'createdAt' | 'processedAt';
  sortDir?: 'asc' | 'desc';
}

export const webhookApi = {
  listEvents(
    params: ListWebhookEventsParams,
  ): Promise<PaginatedResponse<WebhookEvent>> {
    return apiClient.get<PaginatedResponse<WebhookEvent>>('/webhook/events', {
      params,
    });
  },
};
