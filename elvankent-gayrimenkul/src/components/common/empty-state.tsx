import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-sand-300 bg-surface px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon className="size-7" aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-xl text-ink">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-sand-600">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
