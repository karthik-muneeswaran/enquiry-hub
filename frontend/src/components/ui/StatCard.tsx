import { type ReactNode } from 'react';
import { cn } from './cn';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-200 bg-white p-6 shadow-card',
        'transition-all duration-300 hover:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-500 truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-surface-900 tracking-tight">{value}</p>
          {subtitle && <p className="mt-1 text-sm text-surface-500">{subtitle}</p>}
          {trend && (
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                  trend.positive !== false
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700',
                )}
              >
                {trend.positive !== false ? (
                  <ArrowUpIcon className="h-3 w-3" />
                ) : (
                  <ArrowDownIcon className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}%
              </span>
              {trend.label && <span className="text-xs text-surface-400">{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
