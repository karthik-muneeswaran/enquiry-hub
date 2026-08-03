import { apiClient } from './client';
import { PaginatedResponse } from './types';

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  before: unknown | null;
  after: unknown | null;
  performedBy: string;
  requestId: string;
  createdAt: string;
}

export interface ListAuditLogsParams {
  cursor?: string;
  limit?: number;
  entity?: string;
  entityId?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export const auditApi = {
  listLogs(params: ListAuditLogsParams): Promise<PaginatedResponse<AuditLog>> {
    return apiClient.get<PaginatedResponse<AuditLog>>('/audit', { params });
  },
};
