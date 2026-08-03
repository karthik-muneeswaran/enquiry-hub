/**
 * Frontend API response types mirroring the backend's standardized envelope format.
 */

export interface PaginationMeta {
  nextCursor: string | null;
  previousCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: { pagination?: PaginationMeta };
  request_id: string;
  timestamp: string;
}

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  meta: { pagination: PaginationMeta };
};

export interface FieldError {
  field: string;
  message: string;
  constraint: string;
}

export interface NormalizedApiError {
  code: string;
  message: string;
  details?: FieldError[];
  requestId: string;
}
