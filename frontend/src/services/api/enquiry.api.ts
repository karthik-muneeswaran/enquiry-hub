import { apiClient } from './client';
import { PaginationMeta } from './types';

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  propertyTitle: string;
  message: string;
  source: string;
  status: string;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnquiryPayload {
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  propertyTitle: string;
  message: string;
  source: string;
  consentGiven: boolean;
}

export interface ListEnquiriesParams {
  cursor?: string;
  limit?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

interface EnquiriesListResponse {
  data: Enquiry[];
  pagination: PaginationMeta;
}

export const enquiryApi = {
  create(
    payload: CreateEnquiryPayload,
    idempotencyKey?: string,
  ): Promise<Enquiry> {
    return apiClient.post<Enquiry>('/enquiry', payload, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    });
  },

  getById(id: string): Promise<Enquiry> {
    return apiClient.get<Enquiry>(`/enquiry/${id}`);
  },

  list(params: ListEnquiriesParams): Promise<EnquiriesListResponse> {
    return apiClient.get<EnquiriesListResponse>('/enquiries', { params });
  },

  updateStatus(id: string, status: string, performedBy?: string): Promise<Enquiry> {
    return apiClient.patch<Enquiry>(`/enquiry/${id}/status`, { status }, {
      headers: performedBy ? { 'X-Performed-By': performedBy } : {},
    });
  },
};
