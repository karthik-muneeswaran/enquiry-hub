import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_PREFIX = 'form_draft:';
const DEBOUNCE_MS = 500;

interface UsePersistedFormReturn<T> {
  savedValues: T | null;
  hasSavedData: boolean;
  saveValues: (values: T) => void;
  clearSaved: () => void;
}

/**
 * Hook for persisting form state to localStorage with debounced saves.
 * On mount, checks localStorage for previously saved form data.
 * Provides a debounced saveValues function and clearSaved for cleanup on submission.
 */
export function usePersistedForm<T>(
  key: string,
  defaultValues: T
): UsePersistedFormReturn<T> {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savedValues, setSavedValues] = useState<T | null>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Invalid JSON or localStorage unavailable — ignore
      localStorage.removeItem(storageKey);
    }
    return null;
  });

  const hasSavedData = savedValues !== null;

  const saveValues = useCallback(
    (values: T) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(values));
        } catch {
          // localStorage quota exceeded or unavailable — silently ignore
        }
      }, DEBOUNCE_MS);
    },
    [storageKey]
  );

  const clearSaved = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    localStorage.removeItem(storageKey);
    setSavedValues(null);
  }, [storageKey]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { savedValues, hasSavedData, saveValues, clearSaved };
}
