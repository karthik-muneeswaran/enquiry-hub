import React from 'react';

/**
 * Supported skeleton layout types matching final component dimensions.
 * - card: Property card placeholder (image + title + excerpt)
 * - table-row: Admin table row placeholder
 * - detail: Full detail page placeholder (header + body)
 * - form: Form fields placeholder (labels + inputs)
 */
export type SkeletonType = 'card' | 'table-row' | 'detail' | 'form';

export interface SkeletonLoaderProps {
  /** The type of skeleton layout to render */
  type: SkeletonType;
  /** Number of skeleton items to render (useful for lists) */
  count?: number;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} aria-hidden="true" />;
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* Image placeholder */}
      <SkeletonPulse className="mb-4 h-40 w-full rounded-md" />
      {/* Title */}
      <SkeletonPulse className="mb-2 h-5 w-3/4" />
      {/* Excerpt line 1 */}
      <SkeletonPulse className="mb-1 h-4 w-full" />
      {/* Excerpt line 2 */}
      <SkeletonPulse className="mb-3 h-4 w-2/3" />
      {/* Button */}
      <SkeletonPulse className="h-9 w-28 rounded-md" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 px-4 py-3">
      {/* Checkbox */}
      <SkeletonPulse className="h-4 w-4 rounded" />
      {/* Name column */}
      <SkeletonPulse className="h-4 w-32" />
      {/* Email column */}
      <SkeletonPulse className="h-4 w-44" />
      {/* Status badge */}
      <SkeletonPulse className="h-6 w-20 rounded-full" />
      {/* Date column */}
      <SkeletonPulse className="h-4 w-24" />
      {/* Actions */}
      <SkeletonPulse className="ml-auto h-8 w-8 rounded" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <SkeletonPulse className="h-8 w-1/2" />
        <SkeletonPulse className="h-4 w-1/3" />
      </div>
      {/* Hero image */}
      <SkeletonPulse className="h-64 w-full rounded-lg" />
      {/* Content paragraphs */}
      <div className="space-y-2">
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-full" />
        <SkeletonPulse className="h-4 w-5/6" />
        <SkeletonPulse className="h-4 w-4/5" />
      </div>
      {/* Metadata section */}
      <div className="flex gap-4">
        <SkeletonPulse className="h-10 w-32 rounded-md" />
        <SkeletonPulse className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      {/* Form field (repeated) */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-1">
          {/* Label */}
          <SkeletonPulse className="h-4 w-24" />
          {/* Input */}
          <SkeletonPulse className="h-10 w-full rounded-md" />
        </div>
      ))}
      {/* Textarea field */}
      <div className="space-y-1">
        <SkeletonPulse className="h-4 w-20" />
        <SkeletonPulse className="h-24 w-full rounded-md" />
      </div>
      {/* Submit button */}
      <SkeletonPulse className="h-10 w-32 rounded-md" />
    </div>
  );
}

const SKELETON_MAP: Record<SkeletonType, React.FC> = {
  card: CardSkeleton,
  'table-row': TableRowSkeleton,
  detail: DetailSkeleton,
  form: FormSkeleton,
};

/**
 * Configurable skeleton loader component that renders layout-appropriate
 * placeholder shapes matching the final content dimensions.
 * Used during loading states to prevent content jumps.
 */
export function SkeletonLoader({ type, count = 1, className = '' }: SkeletonLoaderProps) {
  const SkeletonComponent = SKELETON_MAP[type];

  return (
    <div className={className} role="status" aria-label="Loading content" aria-busy="true">
      <span className="sr-only">Loading...</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonComponent key={i} />
      ))}
    </div>
  );
}
