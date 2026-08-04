import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { enquiryApi, Enquiry } from '../services/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  ClockIcon,
  DocumentTextIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';

type BadgeVariant = 'warning' | 'info' | 'success' | 'danger' | 'default';

const STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  PENDING: { variant: 'warning', label: 'Pending' },
  PROCESSING: { variant: 'info', label: 'Processing' },
  COMPLETED: { variant: 'success', label: 'Completed' },
  FAILED: { variant: 'danger', label: 'Failed' },
  ARCHIVED: { variant: 'default', label: 'Archived' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailSkeleton() {
  return (
    <div className="max-w-3xl space-y-6 animate-pulse">
      <div className="h-8 w-1/3 rounded-lg bg-surface-200" />
      <div className="h-5 w-1/4 rounded-lg bg-surface-100" />
      <div className="rounded-2xl border border-surface-200 p-6 space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-24 rounded bg-surface-200" />
            <div className="h-4 w-48 rounded bg-surface-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: enquiry,
    isLoading,
    isError,
  } = useQuery<Enquiry>({
    queryKey: ['enquiry', id],
    queryFn: () => enquiryApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (isError || !enquiry) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
            <InboxIcon className="h-8 w-8 text-surface-400" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-surface-700">Enquiry not found</h2>
          <p className="mt-2 text-sm text-surface-500">
            The enquiry you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/enquiries')}>
            Back to Enquiries
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP.PENDING;

  // Timeline data
  const timeline = [
    { label: 'Submitted', date: enquiry.createdAt, active: true },
    {
      label: 'Processing',
      date:
        enquiry.status === 'PROCESSING' || enquiry.status === 'COMPLETED'
          ? enquiry.updatedAt
          : null,
      active: enquiry.status === 'PROCESSING' || enquiry.status === 'COMPLETED',
    },
    {
      label: 'Completed',
      date: enquiry.status === 'COMPLETED' ? enquiry.updatedAt : null,
      active: enquiry.status === 'COMPLETED',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/enquiries')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Enquiries
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Enquiry Details</h1>
          <p className="mt-1 text-sm text-surface-500 font-mono">{enquiry.id}</p>
        </div>
        <Badge variant={statusInfo.variant} size="md" dot>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Status Timeline */}
      <Card padding="md" className="mb-6">
        <div className="flex items-center justify-between">
          {timeline.map((step, index) => (
            <div key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                    step.active
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-surface-200 bg-surface-50 text-surface-400',
                  )}
                >
                  {index + 1}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium',
                    step.active ? 'text-brand-600' : 'text-surface-400',
                  )}
                >
                  {step.label}
                </span>
                {step.date && (
                  <span className="text-[10px] text-surface-400 mt-0.5">
                    {new Date(step.date).toLocaleDateString('en-AU', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
              {index < timeline.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-3',
                    step.active ? 'bg-brand-300' : 'bg-surface-200',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Details card */}
      <Card padding="none">
        <div className="divide-y divide-surface-100">
          <DetailRow
            icon={
              <span className="text-surface-900 font-semibold text-sm">
                {enquiry.name.charAt(0)}
              </span>
            }
            iconBg="bg-brand-50"
            label="Name"
            value={enquiry.name}
          />
          <DetailRow
            icon={<EnvelopeIcon className="h-4 w-4 text-surface-500" />}
            iconBg="bg-surface-50"
            label="Email"
            value={
              <a href={`mailto:${enquiry.email}`} className="text-brand-600 hover:underline">
                {enquiry.email}
              </a>
            }
          />
          {enquiry.phone && (
            <DetailRow
              icon={<PhoneIcon className="h-4 w-4 text-surface-500" />}
              iconBg="bg-surface-50"
              label="Phone"
              value={
                <a href={`tel:${enquiry.phone}`} className="text-brand-600 hover:underline">
                  {enquiry.phone}
                </a>
              }
            />
          )}
          <DetailRow
            icon={<BuildingOfficeIcon className="h-4 w-4 text-surface-500" />}
            iconBg="bg-surface-50"
            label="Property"
            value={
              <button
                type="button"
                onClick={() => navigate(`/properties/${enquiry.propertyId}`)}
                className="text-brand-600 hover:underline text-left"
              >
                {enquiry.propertyTitle}
              </button>
            }
          />
          <DetailRow
            icon={<DocumentTextIcon className="h-4 w-4 text-surface-500" />}
            iconBg="bg-surface-50"
            label="Message"
            value={<span className="whitespace-pre-wrap">{enquiry.message}</span>}
          />
          <DetailRow
            icon={<ClockIcon className="h-4 w-4 text-surface-500" />}
            iconBg="bg-surface-50"
            label="Submitted"
            value={formatDate(enquiry.createdAt)}
          />
          <DetailRow
            icon={<ClockIcon className="h-4 w-4 text-surface-500" />}
            iconBg="bg-surface-50"
            label="Last Updated"
            value={formatDate(enquiry.updatedAt)}
          />
        </div>
      </Card>
    </motion.div>
  );
}

function DetailRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 px-6 py-4">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">{label}</p>
        <div className="mt-0.5 text-sm text-surface-900">{value}</div>
      </div>
    </div>
  );
}
