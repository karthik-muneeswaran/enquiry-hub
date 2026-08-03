import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enquiryApi, Enquiry, CreateEnquiryPayload } from '../services/api';
import { useUI } from '../providers/UIProvider';
import { NormalizedApiError } from '../services/api/types';

export function useCreateEnquiry() {
  const queryClient = useQueryClient();
  const { addToast } = useUI();

  return useMutation<Enquiry, NormalizedApiError, CreateEnquiryPayload>({
    mutationFn: (payload: CreateEnquiryPayload) => enquiryApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      addToast('success', 'Enquiry submitted successfully!');
    },
  });
}
