import { apiClient } from './client';

export interface LivenessStatus {
  status: 'ok';
}

export interface ReadinessStatus {
  status: 'ready' | 'degraded';
  db: string;
  redis: string;
  queue: string;
}

export const healthApi = {
  getLiveness(): Promise<LivenessStatus> {
    return apiClient.get<LivenessStatus>('/health/live');
  },

  getReadiness(): Promise<ReadinessStatus> {
    return apiClient.get<ReadinessStatus>('/health/ready');
  },
};
