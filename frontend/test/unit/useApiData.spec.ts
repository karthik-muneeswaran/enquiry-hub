import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useApiData } from '../../src/hooks/useApiData';

describe('useApiData', () => {
  it('should start in loading state', () => {
    const fetcher = vi.fn(() => new Promise<string>(() => {})); // never resolves

    const { result } = renderHook(() => useApiData(fetcher, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should set data on successful fetch', async () => {
    const fetcher = vi.fn(async () => ({ id: 1, name: 'Test' }));

    const { result } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: 1, name: 'Test' });
    expect(result.current.error).toBeNull();
  });

  it('should set error on failed fetch', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('Network error');
    });

    const { result } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });

  it('should handle non-Error thrown values', async () => {
    const fetcher = vi.fn(async () => {
      throw 'string error';
    });

    const { result } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('An unexpected error occurred');
  });

  it('should pass AbortSignal to fetcher', async () => {
    const fetcher = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return 'data';
    });

    renderHook(() => useApiData(fetcher, []));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
  });

  it('should refetch when deps change', async () => {
    const fetcher = vi.fn(async () => 'result');

    const { result, rerender } = renderHook(
      ({ id }) => useApiData(fetcher, [id]),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ id: 2 });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('should refetch when refetch function is called', async () => {
    const fetcher = vi.fn(async () => 'data');

    const { result } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('should abort previous request on unmount', async () => {
    let abortSignal: AbortSignal | null = null;
    const fetcher = vi.fn(async (signal: AbortSignal) => {
      abortSignal = signal;
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve('data'), 1000);
      });
    });

    const { unmount } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });

    unmount();

    expect(abortSignal!.aborted).toBe(true);
  });
});
