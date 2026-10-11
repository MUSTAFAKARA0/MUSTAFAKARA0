import { cn } from '@/lib/utils';

export function Progress({
  value,
  label,
  className,
  tone = 'primary',
  indeterminate,
}: {
  value: number;
  label: string;
  className?: string;
  tone?: 'primary' | 'success' | 'danger';
  /** Süresi bilinmeyen işlemler (ör. sunucuda görsel işleme) */
  indeterminate?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
      aria-busy={indeterminate || undefined}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          tone === 'primary' && 'bg-primary',
          tone === 'success' && 'bg-success',
          tone === 'danger' && 'bg-danger',
          indeterminate && 'animate-pulse',
        )}
        style={{ width: `${indeterminate ? 100 : pct}%` }}
      />
    </div>
  );
}
