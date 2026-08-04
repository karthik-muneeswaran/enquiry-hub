import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEnquiries } from '../hooks/useEnquiries';
import { useUpdateEnquiryStatus } from '../hooks/useUpdateEnquiryStatus';
import { ListEnquiriesParams } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { Permission } from '../auth/users';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import {
  MagnifyingGlassIcon,
  InboxIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

type EnquiryStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

const STATUS_OPTIONS: EnquiryStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'ARCHIVED',
];

const STATUS_BADGE_MAP: Record<
  EnquiryStatus,
  { variant: 'warning' | 'info' | 'success' | 'danger' | 'default'; label: string }
> = {
  PENDING: { variant: 'warning', label: 'Pending' },
  PROCESSING: { variant: 'info', label: 'Processing' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  FAILED: { variant: 'danger', label: 'Failed' },
  ARCHIVED: { variant: 'default', label: 'Archived' },
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const params: ListEnquiriesParams = useMemo(
    () => ({
      cursor: searchParams.get('cursor') || undefined,
      limit: 20,
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc',
    }),
    [searchParams],
  );

  const { data, isLoading, isError, isFetching } = useEnquiries(params);
  const updateStatusMutation = useUpdateEnquiryStatus();
  const { hasPermission } = useAuth();
  const canUpdateStatus = hasPermission(Permission.ENQUIRY_UPDATE_STATUS);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== 'cursor') {
          next.delete('cursor');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const goToPage = useCallback(
    (cursor: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (cursor) {
          next.set('cursor', cursor);
        } else {
          next.delete('cursor');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const enquiries = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 sm:text-display-xs">Enquiries</h1>
          <p className="mt-1 text-sm text-surface-500">Manage and review property enquiries</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
              isFetching
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-green-200 bg-green-50 text-green-700',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isFetching ? 'bg-blue-500 animate-pulse' : 'bg-green-500',
              )}
            />
            {isFetching ? 'Refreshing...' : 'Live'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <Card padding="none">
        <div className="flex items-center gap-2 border-b border-surface-100 px-4 py-3 sm:px-6">
          <FunnelIcon className="h-4 w-4 text-surface-400" />
          <span className="text-sm font-medium text-surface-600">Filters</span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search name, email..."
              value={searchParams.get('search') || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="block w-full rounded-xl border border-surface-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {/* Status */}
          <select
            value={searchParams.get('status') || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="block w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            value={searchParams.get('dateFrom') || ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="block w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="From date"
          />

          {/* Date to */}
          <input
            type="date"
            value={searchParams.get('dateTo') || ''}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="block w-full rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="To date"
          />
        </div>
      </Card>

      {/* Table / Card List */}
      <Card padding="none">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-surface-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-surface-200" />
                  <div className="h-3 w-1/2 rounded bg-surface-100" />
                </div>
                <div className="h-6 w-20 rounded-full bg-surface-200" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-8 text-center">
            <XCircleIcon className="mx-auto h-10 w-10 text-red-300" />
            <p className="mt-2 text-sm text-red-600">Failed to load enquiries. Please try again.</p>
          </div>
        ) : enquiries.length === 0 ? (
          <div className="p-12 text-center">
            <InboxIcon className="mx-auto h-12 w-12 text-surface-300" />
            <p className="mt-3 text-sm font-medium text-surface-600">No enquiries found</p>
            <p className="mt-1 text-xs text-surface-400">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {enquiries.map((enquiry) => {
                    const statusInfo =
                      STATUS_BADGE_MAP[enquiry.status as EnquiryStatus] || STATUS_BADGE_MAP.PENDING;
                    return (
                      <tr
                        key={enquiry.id}
                        onClick={() => navigate(`/enquiry/${enquiry.id}`)}
                        className="cursor-pointer transition-colors hover:bg-surface-50"
                      >
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="text-sm font-medium text-surface-900">
                            {enquiry.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-surface-600">
                          {enquiry.email}
                        </td>
                        <td
                          className="max-w-[200px] truncate px-6 py-4 text-sm text-surface-600"
                          title={enquiry.propertyTitle}
                        >
                          {enquiry.propertyTitle}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {canUpdateStatus ? (
                            <select
                              value={enquiry.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateStatusMutation.mutate({
                                  id: enquiry.id,
                                  status: e.target.value,
                                });
                              }}
                              className={cn(
                                'rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs font-medium focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-200',
                                enquiry.status === 'COMPLETED' && 'text-green-700',
                                enquiry.status === 'PROCESSING' && 'text-blue-700',
                                enquiry.status === 'PENDING' && 'text-amber-700',
                                enquiry.status === 'FAILED' && 'text-red-700',
                                enquiry.status === 'ARCHIVED' && 'text-surface-500',
                              )}
                              disabled={updateStatusMutation.isPending}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_BADGE_MAP[s].label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant={statusInfo.variant} dot>
                              {statusInfo.label}
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-surface-500">
                          {formatDate(enquiry.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-surface-100 lg:hidden">
              {enquiries.map((enquiry) => {
                const statusInfo =
                  STATUS_BADGE_MAP[enquiry.status as EnquiryStatus] || STATUS_BADGE_MAP.PENDING;
                return (
                  <button
                    key={enquiry.id}
                    type="button"
                    onClick={() => navigate(`/enquiry/${enquiry.id}`)}
                    className="w-full px-4 py-4 text-left transition-colors hover:bg-surface-50 sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-surface-900 truncate">
                          {enquiry.name}
                        </p>
                        <p className="mt-0.5 text-xs text-surface-500 truncate">{enquiry.email}</p>
                        <p className="mt-1 text-xs text-surface-400 truncate">
                          {enquiry.propertyTitle}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {canUpdateStatus ? (
                          <select
                            value={enquiry.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateStatusMutation.mutate({
                                id: enquiry.id,
                                status: e.target.value,
                              });
                            }}
                            className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs font-medium focus:border-brand-500 focus:outline-none"
                            disabled={updateStatusMutation.isPending}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_BADGE_MAP[s].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant={statusInfo.variant} size="sm">
                            {statusInfo.label}
                          </Badge>
                        )}
                        <span className="text-[10px] text-surface-400">
                          {formatDate(enquiry.createdAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && (
          <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3 sm:px-6">
            <div className="text-sm text-surface-500">
              {pagination.totalCount != null && <span>{pagination.totalCount} total</span>}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(pagination.previousCursor)}
                disabled={!pagination.previousCursor}
                icon={<ChevronLeftIcon className="h-4 w-4" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => goToPage(pagination.nextCursor)}
                disabled={!pagination.hasMore}
                iconRight={<ChevronRightIcon className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
