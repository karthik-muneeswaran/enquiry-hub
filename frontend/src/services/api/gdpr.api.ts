import { apiClient } from './client';
import { PaginationMeta } from './types';

export interface GdprRecord {
  type: 'enquiry' | 'audit';
  data: unknown;
}

export interface GdprEraseResult {
  erasedRecords: number;
  erasedAt: string;
}

export interface GdprExportParams {
  cursor?: string;
  limit?: number;
  entity?: 'enquiry' | 'audit' | 'all';
}

interface GdprExportResponse {
  data: GdprRecord[];
  pagination: PaginationMeta;
}

export const gdprApi = {
  exportData(email: string, params?: GdprExportParams): Promise<GdprExportResponse> {
    return apiClient.get<GdprExportResponse>(`/gdpr/export/${encodeURIComponent(email)}`, {
      params,
    });
  },

  eraseData(email: string): Promise<GdprEraseResult> {
    return apiClient.delete<GdprEraseResult>(`/gdpr/erase/${encodeURIComponent(email)}`);
  },
};
