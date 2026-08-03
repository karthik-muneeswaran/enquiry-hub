import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfflineQueue } from '../../src/services/OfflineQueue';

// Mock the apiClient
vi.mock('../../src/services/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '../../src/services/api/client';

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    localStorage.clear();
    queue = new OfflineQueue();
  });

  it('enqueue adds item to localStorage queue', () => {
    const data = { name: 'John', email: 'john@test.com', phone: '123', propertyId: 'p1', propertyTitle: 'Title', message: 'Hi', source: 'web', consentGiven: true };
    queue.enqueue('/enquiry', data);

    expect(queue.getPendingCount()).toBe(1);
    const items = queue.getQueue();
    expect(items[0].endpoint).toBe('/enquiry');
    expect(items[0].data).toEqual(data);
    expect(items[0].id).toBeDefined();
    expect(items[0].timestamp).toBeGreaterThan(0);
  });

  it('flush sends queued items and removes successful ones', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} });

    const data = { name: 'A', email: 'a@test.com', phone: '1', propertyId: 'p1', propertyTitle: 'T', message: 'M', source: 'web', consentGiven: true };
    queue.enqueue('/enquiry', data);
    queue.enqueue('/enquiry', data);

    const results = await queue.flush();

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'success')).toBe(true);
    expect(queue.getPendingCount()).toBe(0);
  });

  it('flush keeps failed items in queue', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ success: true, data: {} })
      .mockRejectedValueOnce(new Error('Network error'));

    const data = { name: 'A', email: 'a@test.com', phone: '1', propertyId: 'p1', propertyTitle: 'T', message: 'M', source: 'web', consentGiven: true };
    queue.enqueue('/enquiry', data);
    queue.enqueue('/enquiry', data);

    const results = await queue.flush();

    expect(results[0].status).toBe('success');
    expect(results[1].status).toBe('error');
    expect(queue.getPendingCount()).toBe(1);
  });

  it('getPendingCount returns 0 for empty queue', () => {
    expect(queue.getPendingCount()).toBe(0);
  });
});
