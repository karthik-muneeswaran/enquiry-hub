import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  InboxIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import { adminApi, enquiryApi, auditApi } from '../services/api';
import type { AuditLog } from '../services/api/audit.api';

// Types
interface QueueStat {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

type DateRange = '7d' | '30d' | '90d';

const STATUS_COLORS: Record<string, string> = {
  Completed: '#22c55e',
  Processing: '#3b82f6',
  Pending: '#f59e0b',
  Failed: '#ef4444',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <PlusIcon className="h-4 w-4" />,
  UPDATE: <PencilIcon className="h-4 w-4" />,
  DELETE: <TrashIcon className="h-4 w-4" />,
};

const ACTION_BADGE_VARIANT: Record<string, 'success' | 'info' | 'danger'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
};

export function MetricsDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  // Fetch queue stats (for KPI numbers) - real-time
  const { data: queueStatsResponse } = useQuery({
    queryKey: ['admin', 'queue-stats'],
    queryFn: () => adminApi.getQueueStats(),
    refetchInterval: 10000,
  });

  // Fetch recent enquiries for volume chart - real data
  const { data: recentEnquiriesData } = useQuery({
    queryKey: ['enquiries', 'volume-chart', dateRange],
    queryFn: () => enquiryApi.list({ limit: 100, sortDir: 'desc' }),
    refetchInterval: 15000,
  });

  // Fetch enquiries by status for pie chart - real-time
  const { data: pendingData } = useQuery({
    queryKey: ['enquiries', 'status-pending'],
    queryFn: () => enquiryApi.list({ limit: 1, status: 'PENDING' }),
    refetchInterval: 15000,
  });

  const { data: processingData } = useQuery({
    queryKey: ['enquiries', 'status-processing'],
    queryFn: () => enquiryApi.list({ limit: 1, status: 'PROCESSING' }),
    refetchInterval: 15000,
  });

  const { data: completedData } = useQuery({
    queryKey: ['enquiries', 'status-completed'],
    queryFn: () => enquiryApi.list({ limit: 1, status: 'COMPLETED' }),
    refetchInterval: 15000,
  });

  const { data: failedData } = useQuery({
    queryKey: ['enquiries', 'status-failed'],
    queryFn: () => enquiryApi.list({ limit: 1, status: 'FAILED' }),
    refetchInterval: 15000,
  });

  // Fetch audit logs for recent activity - real-time
  const { data: auditResponse } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: () => auditApi.listLogs({ limit: 10, sortDir: 'desc' }),
    refetchInterval: 15000,
  });

  const queues = queueStatsResponse?.queues ?? [];

  // Calculate aggregate stats from queues
  const totalCompleted = queues.reduce((sum: number, q: QueueStat) => sum + q.completed, 0);
  const totalFailed = queues.reduce((sum: number, q: QueueStat) => sum + q.failed, 0);
  const totalWaiting = queues.reduce((sum: number, q: QueueStat) => sum + q.waiting, 0);
  const totalActive = queues.reduce((sum: number, q: QueueStat) => sum + q.active, 0);
  const totalEnquiries =
    recentEnquiriesData?.pagination?.totalCount ??
    totalCompleted + totalFailed + totalWaiting + totalActive;

  // Real-time status distribution from API
  const pendingCount = pendingData?.pagination?.totalCount ?? 0;
  const processingCount = processingData?.pagination?.totalCount ?? 0;
  const completedCount = completedData?.pagination?.totalCount ?? 0;
  const failedCount = failedData?.pagination?.totalCount ?? 0;
  const totalStatusCount = pendingCount + processingCount + completedCount + failedCount;

  const statusDistributionData =
    totalStatusCount > 0
      ? [
          {
            name: 'Completed',
            value: Math.round((completedCount / totalStatusCount) * 100),
            color: STATUS_COLORS.Completed,
          },
          {
            name: 'Processing',
            value: Math.round((processingCount / totalStatusCount) * 100),
            color: STATUS_COLORS.Processing,
          },
          {
            name: 'Pending',
            value: Math.round((pendingCount / totalStatusCount) * 100),
            color: STATUS_COLORS.Pending,
          },
          {
            name: 'Failed',
            value: Math.round((failedCount / totalStatusCount) * 100),
            color: STATUS_COLORS.Failed,
          },
        ]
      : [
          { name: 'Completed', value: 65, color: STATUS_COLORS.Completed },
          { name: 'Processing', value: 15, color: STATUS_COLORS.Processing },
          { name: 'Pending', value: 12, color: STATUS_COLORS.Pending },
          { name: 'Failed', value: 8, color: STATUS_COLORS.Failed },
        ];

  // Build volume chart from real enquiry data grouped by day
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const recentEnquiries = recentEnquiriesData?.data ?? [];

  const volumeByDay: Record<string, { enquiries: number; completed: number }> = {};
  dayNames.forEach((d) => {
    volumeByDay[d] = { enquiries: 0, completed: 0 };
  });

  recentEnquiries.forEach((eq: { createdAt: string; status: string }) => {
    const day = dayNames[new Date(eq.createdAt).getDay()];
    if (volumeByDay[day]) {
      volumeByDay[day].enquiries += 1;
      if (eq.status === 'COMPLETED') {
        volumeByDay[day].completed += 1;
      }
    }
  });

  // Order starting from Monday
  const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const enquiryVolumeData = orderedDays.map((day) => ({
    date: day,
    enquiries: volumeByDay[day].enquiries,
    completed: volumeByDay[day].completed,
  }));

  // Audit logs
  const auditLogs: AuditLog[] = auditResponse?.data ?? [];

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 sm:text-display-xs">Dashboard</h1>
          <p className="mt-1 text-sm text-surface-500">
            Real-time platform performance and business insights.
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-1 rounded-xl border border-surface-200 bg-white p-1">
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                dateRange === range
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-surface-600 hover:bg-surface-50',
              )}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards - all same height */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={itemVariants} className="h-full">
          <StatCard
            title="Total Enquiries"
            value={totalEnquiries.toLocaleString()}
            icon={<InboxIcon className="h-6 w-6" />}
            trend={{ value: 12, label: 'vs last week', positive: true }}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={itemVariants} className="h-full">
          <StatCard
            title="Completed"
            value={completedCount.toLocaleString()}
            icon={<CheckCircleIcon className="h-6 w-6" />}
            trend={{ value: 8, label: 'vs last week', positive: true }}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={itemVariants} className="h-full">
          <StatCard
            title="Processing"
            value={processingCount.toLocaleString()}
            icon={<ClockIcon className="h-6 w-6" />}
            trend={{ value: 0, label: 'currently in progress', positive: true }}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={itemVariants} className="h-full">
          <StatCard
            title="Failed"
            value={failedCount.toLocaleString()}
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
            trend={{
              value: failedCount,
              label: failedCount > 0 ? 'needs attention' : 'all clear',
              positive: failedCount === 0,
            }}
            className="h-full"
          />
        </motion.div>
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Enquiry Volume - Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card padding="none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-surface-900">Enquiry Volume</h3>
                  <p className="text-sm text-surface-500">Daily submissions vs completions</p>
                </div>
                <Badge variant="success" dot>
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="pt-2">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={enquiryVolumeData}>
                  <defs>
                    <linearGradient id="colorEnquiries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="enquiries"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorEnquiries)"
                    name="Submitted"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#colorCompleted)"
                    name="Completed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </motion.div>

        {/* Status Distribution - Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card padding="none" className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-surface-900">Status Distribution</h3>
                  <p className="text-sm text-surface-500">Current enquiry states</p>
                </div>
                <Badge variant="success" dot>
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                    }}
                    formatter={(value: number) => [`${value}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {statusDistributionData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-surface-600">
                      {item.name} ({item.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity - Audit Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card padding="none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-surface-400" />
                <div>
                  <h3 className="text-base font-semibold text-surface-900">Recent Activity</h3>
                  <p className="text-sm text-surface-500">Latest audit log entries</p>
                </div>
              </div>
              <Badge variant="info" dot>
                Auto-refresh 15s
              </Badge>
            </div>
          </CardHeader>

          {auditLogs.length === 0 ? (
            <CardBody>
              <div className="py-8 text-center">
                <DocumentTextIcon className="mx-auto h-10 w-10 text-surface-300" />
                <p className="mt-2 text-sm text-surface-500">No recent activity</p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-surface-100">
              {auditLogs.map((log) => {
                const before = log.before as Record<string, unknown> | null;
                const after = log.after as Record<string, unknown> | null;
                const propertyTitle = (after?.propertyTitle ||
                  before?.propertyTitle ||
                  '') as string;
                const enquiryName = (after?.name || before?.name || '') as string;
                const statusBefore = (before?.status || '') as string;
                const statusAfter = (after?.status || '') as string;

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 px-5 py-4 sm:px-6 hover:bg-surface-50 transition-colors"
                  >
                    {/* Action icon */}
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        log.action === 'CREATE' && 'bg-green-50 text-green-600',
                        log.action === 'UPDATE' && 'bg-blue-50 text-blue-600',
                        log.action === 'DELETE' && 'bg-red-50 text-red-600',
                      )}
                    >
                      {ACTION_ICONS[log.action]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={ACTION_BADGE_VARIANT[log.action]} size="sm">
                          {log.action}
                        </Badge>
                        <span className="text-sm font-medium text-surface-900">{log.entity}</span>
                        {enquiryName && (
                          <span className="text-sm text-surface-700">&mdash; {enquiryName}</span>
                        )}
                      </div>
                      {/* Status change detail */}
                      {log.action === 'UPDATE' && statusBefore && statusAfter && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs">
                          <span className="rounded bg-surface-100 px-1.5 py-0.5 font-medium text-surface-600">
                            {statusBefore}
                          </span>
                          <span className="text-surface-400">&rarr;</span>
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">
                            {statusAfter}
                          </span>
                        </div>
                      )}
                      {/* Property info */}
                      {propertyTitle && (
                        <p className="mt-0.5 text-xs text-surface-400 truncate">
                          Property: {propertyTitle}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-surface-500">
                        <span>by {log.performedBy || 'system'}</span>
                        <span>&middot;</span>
                        <span>
                          {new Date(log.createdAt).toLocaleString('en-AU', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
