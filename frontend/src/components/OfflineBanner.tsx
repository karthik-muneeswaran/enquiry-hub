import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { offlineQueue } from '../services/OfflineQueue';

/**
 * Displays a warning banner when the user is offline.
 * Shows the number of pending queued submissions.
 * Auto-flushes the offline queue when connectivity is restored.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(offlineQueue.getPendingCount());
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  // Refresh pending count whenever online status changes
  useEffect(() => {
    setPendingCount(offlineQueue.getPendingCount());
  }, [isOnline]);

  // Auto-flush when back online
  useEffect(() => {
    if (!isOnline) return;
    if (pendingCount === 0) return;

    let cancelled = false;

    offlineQueue.flush().then((results) => {
      if (cancelled) return;

      const successCount = results.filter((r) => r.status === 'success').length;
      const failCount = results.filter((r) => r.status === 'error').length;

      setPendingCount(offlineQueue.getPendingCount());

      if (successCount > 0 && failCount === 0) {
        setFlushMessage(`${successCount} pending submission${successCount > 1 ? 's' : ''} sent successfully.`);
      } else if (successCount > 0 && failCount > 0) {
        setFlushMessage(
          `${successCount} sent, ${failCount} failed and will retry later.`,
        );
      }

      // Clear the flush message after 5 seconds
      setTimeout(() => {
        if (!cancelled) setFlushMessage(null);
      }, 5000);
    });

    return () => {
      cancelled = true;
    };
  }, [isOnline, pendingCount]);

  // Show flush success message briefly after reconnecting
  if (isOnline && flushMessage) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-b border-green-200 bg-green-50 px-4 py-2 text-center text-sm text-green-800"
      >
        {flushMessage}
      </div>
    );
  }

  // Don't render anything when online with no messages
  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-800"
    >
      <span className="font-medium">You&apos;re offline</span>
      {pendingCount > 0 && (
        <span>
          {' '}
          &mdash; {pendingCount} submission{pendingCount > 1 ? 's' : ''} queued
        </span>
      )}
      <span className="ml-1">(submissions will be sent when you reconnect)</span>
    </div>
  );
}
