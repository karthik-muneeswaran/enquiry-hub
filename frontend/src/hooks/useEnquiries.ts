import { useQuery } from '@tanstack/react-query';
import { enquiryApi, ListEnquiriesParams, Enquiry } from '../services/api';
import { PaginationMeta } from '../services/api/types';

interface EnquiriesResponse {
  data: Enquiry[];
  pagination: PaginationMeta;
}

export function useEnquiries(params: ListEnquiriesParams) {
  return useQuery<EnquiriesResponse>({
    queryKey: ['enquiries', params],
    queryFn: () => enquiryApi.list(params),
    refetchInterval: 30_000,
  });
}
