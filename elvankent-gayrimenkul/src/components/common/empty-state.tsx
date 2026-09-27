import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14 sm:py-16',
        className,
      )}
    >
      <span className={cn('flex items-center justify-center rounded-2xl bg-primary-soft text-primary-ink', compact ? 'size-11' : 'size-14')}>
        <Icon className={compact ? 'size-5' : 'size-7'} aria-hidden />
      </span>
      <h2 className={cn('font-display text-foreground', compact ? 'mt-4 text-lg' : 'mt-5 text-xl sm:text-2xl')}>{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
