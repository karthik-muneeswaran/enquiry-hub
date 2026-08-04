import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * State representation for the useApiData hook.
 * Every data-fetching component should use these three states:
 * loading (skeleton), success (data), error (message + retry).
 */
export interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * A fetcher function that accepts an AbortSignal for request cancellation.
 */
export type Fetcher<T> = (signal: AbortSignal) => Promise<T>;

/**
 * Generic data-fetching hook with AbortController for request cancellation on unmount
 * or dependency change. Manages loading, success, and error states.
 *
 * @param fetcher - An async function that receives an AbortSignal and returns data.
 * @param deps - Dependency array that triggers a re-fetch when changed.
 * @returns An object with data, loading, error states, and a refetch function.
 */
export function useApiData<T>(fetcher: Fetcher<T>, deps: unknown[] = []) {
  const [state, setState] = useState<ApiDataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => {
    const controller = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      });

    return controller;
  }, []);

  useEffect(() => {
    const controller = refetch();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    ...state,
    refetch: () => {
      refetch();
    },
  };
}
