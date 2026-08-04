import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { adminApi } from '../services/api';
import { useUI } from '../providers/UIProvider';
import type { DeadLetterJob } from '../services/api/admin.api';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  QueueListIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export function QueueDashboardPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUI();

  const {
    data: statsResponse,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['admin', 'queue-stats'],
    queryFn: () => adminApi.getQueueStats(),
    refetchInterval: 15000,
  });

  const {
    data: dlqResponse,
    isLoading: dlqLoading,
  } = useQuery({
    queryKey: ['admin', 'dlq'],
    queryFn: () => adminApi.getDlqJobs({ limit: 50 }),
    refetchInterval: 15000,
  });

  const pauseMutation = useMutation({
    mutationFn: (queueName: string) => adminApi.pauseQueue(queueName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue-stats'] });
      addToast('success', 'Queue paused');
    },
    onError: () => addToast('error', 'Failed to pause queue'),
  });

  const resumeMutation = useMutation({
    mutationFn: (queueName: string) => adminApi.resumeQueue(queueName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue-stats'] });
      addToast('success', 'Queue resumed');
    },
    onError: () => addToast('error', 'Failed to resume queue'),
  });

  const retryJobMutation = useMutation({
    mutationFn: ({ queueName, jobId }: { queueName: string; jobId: string }) =>
      adminApi.retryJob(queueName, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue-stats'] });
      addToast('success', 'Job retried successfully');
    },
    onError: () => addToast('error', 'Failed to retry job'),
  });

  const queues: Array<{ name: string; active: number; waiting: number; completed: number; failed: number; delayed: number; paused: boolean }> = (statsResponse as any)?.data?.queues ?? (statsResponse as any)?.queues ?? [];
  const dlqJobs: DeadLetterJob[] = (dlqResponse as any)?.data ?? dlqResponse ?? [];

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-48 rounded-lg bg-surface-200 animate-pulse" />
            <div className="mt-2 h-4 w-32 rounded bg-surface-100 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-200 bg-white p-6 animate-pulse">
              <div className="h-5 w-1/2 rounded bg-surface-200 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 rounded-xl bg-surface-100" />
                <div className="h-12 rounded-xl bg-surface-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-surface-900">Queue Management</h1>
        <Card padding="md">
          <div className="flex items-center gap-3 text-red-700">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <p className="text-sm">Failed to load queue statistics. Please try again later.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 sm:text-display-xs">
            Queue Management
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            Monitor and manage background job queues
          </p>
        </div>
        <Badge variant="info" dot>
          Auto-refresh 15s
        </Badge>
      </div>

      {/* Queue Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {queues.map((queue) => (
          <Card key={queue.name} padding="none" hover className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <QueueListIcon className="h-5 w-5 text-surface-400" />
                  <h3 className="text-sm font-semibold text-surface-900">{queue.name}</h3>
                </div>
                <Badge variant={queue.paused ? 'warning' : 'success'} size="sm" dot>
                  {queue.paused ? 'Paused' : 'Active'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{queue.waiting}</p>
                  <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Waiting</p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3 text-center">
                  <p className="text-xl font-bold text-indigo-700">{queue.active}</p>
                  <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-wide">Active</p>
                </div>
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{queue.completed}</p>
                  <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Done</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3 text-center">
                  <p className="text-xl font-bold text-red-700">{queue.failed}</p>
                  <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide">Failed</p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4">
                {queue.paused ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => resumeMutation.mutate(queue.name)}
                    loading={resumeMutation.isPending}
                    icon={<PlayIcon className="h-4 w-4" />}
                  >
                    Resume Queue
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => pauseMutation.mutate(queue.name)}
                    loading={pauseMutation.isPending}
                    icon={<PauseIcon className="h-4 w-4" />}
                  >
                    Pause Queue
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Dead Letter Queue */}
      <Card padding="none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-semibold text-surface-900">
                Dead Letter Queue
              </h2>
              <Badge variant="danger" size="sm">
                {dlqJobs.length}
              </Badge>
            </div>
          </div>
        </CardHeader>

        {dlqLoading ? (
          <CardBody>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-surface-100 animate-pulse" />
              ))}
            </div>
          </CardBody>
        ) : dlqJobs.length === 0 ? (
          <CardBody>
            <div className="py-8 text-center">
              <CheckCircleIcon className="mx-auto h-10 w-10 text-green-300" />
              <p className="mt-2 text-sm text-surface-500">No failed jobs. All clear!</p>
            </div>
          </CardBody>
        ) : (
          <div className="divide-y divide-surface-100">
            {dlqJobs.map((job) => (
              <DlqJobRow
                key={job.id}
                job={job}
                onRetry={() =>
                  retryJobMutation.mutate({
                    queueName: job.queueName,
                    jobId: job.id,
                  })
                }
                isRetrying={retryJobMutation.isPending}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function DlqJobRow({
  job,
  onRetry,
  isRetrying,
}: {
  job: DeadLetterJob;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" size="sm">{job.queueName}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-surface-400">
              <ClockIcon className="h-3 w-3" />
              {new Date(job.failedAt).toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-surface-400">
              <ArrowPathIcon className="h-3 w-3" />
              {job.attemptsMade} attempts
            </span>
          </div>
          <p className="mt-1.5 text-sm text-red-600 truncate">{job.failedReason}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            loading={isRetrying}
            icon={<ArrowPathIcon className="h-3.5 w-3.5" />}
          >
            Retry
          </Button>
        </div>
      </div>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 overflow-hidden"
        >
          <div className="rounded-xl bg-surface-50 p-4 overflow-auto max-h-48">
            <pre className="text-xs font-mono text-surface-700 whitespace-pre-wrap">
              {JSON.stringify(job.data, null, 2)}
            </pre>
          </div>
        </motion.div>
      )}
    </div>
  );
}
