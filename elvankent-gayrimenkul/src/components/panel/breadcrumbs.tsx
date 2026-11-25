import Link from '@/components/common/intent-link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

/** Sayfa yolu: son öğe geçerli sayfadır (aria-current), diğerleri bağlantıdır */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Sayfa yolu" className={cn('mb-2', className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="inline-flex min-h-6 items-center rounded font-medium hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn(last && 'font-semibold text-foreground')}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
