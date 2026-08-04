import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enquiryApi, Enquiry } from '../services/api';
import { useUI } from '../providers/UIProvider';
import { useAuth } from '../auth/AuthContext';
import { NormalizedApiError } from '../services/api/types';

interface UpdateStatusVariables {
  id: string;
  status: string;
}

export function useUpdateEnquiryStatus() {
  const queryClient = useQueryClient();
  const { addToast } = useUI();
  const { user } = useAuth();

  return useMutation<Enquiry, NormalizedApiError, UpdateStatusVariables>({
    mutationFn: ({ id, status }) => enquiryApi.updateStatus(id, status, user?.name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      addToast('success', `Status updated to ${variables.status}`);
    },
    onError: (error) => {
      addToast('error', error.message || 'Failed to update status');
    },
  });
}
