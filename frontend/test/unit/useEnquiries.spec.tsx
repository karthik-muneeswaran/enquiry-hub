import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { ReactNode } from 'react';
import { useEnquiries } from '../../src/hooks/useEnquiries';

// Mock the API module
const mockList = vi.fn();
vi.mock('../../src/services/api', () => ({
  enquiryApi: {
    list: (...args: any[]) => mockList(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockResponse = {
  data: [
    {
      id: 'enq-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+61412345678',
      propertyId: 'prop-1',
      propertyTitle: 'Nice House',
      message: 'Interested',
      source: 'website',
      status: 'PENDING',
      consentGiven: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  pagination: {
    nextCursor: null,
    previousCursor: null,
    hasMore: false,
    totalCount: 1,
  },
};

describe('useEnquiries', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('should fetch enquiries with given params', async () => {
    mockList.mockResolvedValue(mockResponse);

    const params = { limit: 20, sortDir: 'desc' as const };

    const { result } = renderHook(() => useEnquiries(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockList).toHaveBeenCalledWith(params);
    expect(result.current.data).toEqual(mockResponse);
  });

  it('should start in loading state', () => {
    mockList.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useEnquiries({ limit: 10 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should set error state on API failure', async () => {
    mockList.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useEnquiries({ limit: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should refetch when params change', async () => {
    mockList.mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(
      ({ params }) => useEnquiries(params),
      {
        initialProps: { params: { limit: 10, sortDir: 'desc' as const } },
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    rerender({ params: { limit: 10, sortDir: 'asc' as const } });

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  it('should pass search params to the API', async () => {
    mockList.mockResolvedValue(mockResponse);

    const params = { limit: 20, search: 'john', status: 'PENDING' };

    const { result } = renderHook(() => useEnquiries(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockList).toHaveBeenCalledWith(params);
  });
});
