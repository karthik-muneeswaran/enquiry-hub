import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactNode } from 'react';
import { useCreateEnquiry } from '../../src/hooks/useCreateEnquiry';
import { UIProvider } from '../../src/providers/UIProvider';

// Mock the API module
const mockCreate = vi.fn();
vi.mock('../../src/services/api', () => ({
  enquiryApi: {
    create: (...args: any[]) => mockCreate(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UIProvider>{children}</UIProvider>
      </QueryClientProvider>
    );
  };
}

const validPayload = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+61412345678',
  propertyId: 'prop-123',
  propertyTitle: 'Nice House',
  message: 'Interested',
  source: 'website',
  consentGiven: true,
};

describe('useCreateEnquiry', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should return mutation object with mutate function', () => {
    const { result } = renderHook(() => useCreateEnquiry(), {
      wrapper: createWrapper(),
    });

    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it('should call enquiryApi.create on mutate', async () => {
    mockCreate.mockResolvedValue({ id: 'enq-1', ...validPayload, status: 'PENDING' });

    const { result } = renderHook(() => useCreateEnquiry(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCreate).toHaveBeenCalledWith(validPayload);
  });

  it('should set isSuccess on successful mutation', async () => {
    mockCreate.mockResolvedValue({ id: 'enq-1', ...validPayload, status: 'PENDING' });

    const { result } = renderHook(() => useCreateEnquiry(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should set isError on failed mutation', async () => {
    mockCreate.mockRejectedValue({ message: 'Duplicate enquiry', status: 409 });

    const { result } = renderHook(() => useCreateEnquiry(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validPayload);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
