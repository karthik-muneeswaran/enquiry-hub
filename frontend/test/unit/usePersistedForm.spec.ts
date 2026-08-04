import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePersistedForm } from '../../src/hooks/usePersistedForm';

describe('usePersistedForm', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null savedValues when no data in localStorage', () => {
    const { result } = renderHook(() =>
      usePersistedForm('test-form', { name: '', email: '' }),
    );
    expect(result.current.savedValues).toBeNull();
    expect(result.current.hasSavedData).toBe(false);
  });

  it('reads saved state from localStorage on mount', () => {
    const saved = { name: 'John', email: 'john@test.com' };
    localStorage.setItem('form_draft:test-form', JSON.stringify(saved));

    const { result } = renderHook(() =>
      usePersistedForm('test-form', { name: '', email: '' }),
    );
    expect(result.current.savedValues).toEqual(saved);
    expect(result.current.hasSavedData).toBe(true);
  });

  it('saveValues debounces writes to localStorage (500ms)', () => {
    const { result } = renderHook(() =>
      usePersistedForm('test-form', { name: '', email: '' }),
    );

    act(() => {
      result.current.saveValues({ name: 'A', email: 'a@b.com' });
    });

    // Not yet persisted
    expect(localStorage.getItem('form_draft:test-form')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now persisted
    const stored = JSON.parse(localStorage.getItem('form_draft:test-form')!);
    expect(stored).toEqual({ name: 'A', email: 'a@b.com' });
  });

  it('clearSaved removes from localStorage and resets state', () => {
    localStorage.setItem('form_draft:test-form', JSON.stringify({ name: 'Old' }));

    const { result } = renderHook(() =>
      usePersistedForm('test-form', { name: '', email: '' }),
    );

    expect(result.current.hasSavedData).toBe(true);

    act(() => {
      result.current.clearSaved();
    });

    expect(result.current.savedValues).toBeNull();
    expect(result.current.hasSavedData).toBe(false);
    expect(localStorage.getItem('form_draft:test-form')).toBeNull();
  });
});
