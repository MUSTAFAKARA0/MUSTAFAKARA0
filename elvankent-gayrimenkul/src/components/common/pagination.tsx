import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function pageList(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

/** Sunucu tarafı sayfalama: her sayfa gerçek bir URL'dir (SEO dostu) */
export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const item = 'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold transition';
  return (
    <nav aria-label="Sayfalama" className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} className={cn(item, 'hover:bg-surface-muted')} rel="prev">
              <ChevronLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Önceki</span>
            </Link>
          ) : (
            <span className={cn(item, 'text-muted-foreground/50')} aria-disabled>
              <ChevronLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Önceki</span>
            </span>
          )}
        </li>
        {pageList(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <li key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Sayfa ${p}`}
                className={cn(item, 'numeric', p === page ? 'bg-foreground text-background' : 'border border-border bg-surface hover:border-border-strong')}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1)} className={cn(item, 'hover:bg-surface-muted')} rel="next">
              <span className="hidden sm:inline">Sonraki</span> <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(item, 'text-muted-foreground/50')} aria-disabled>
              <span className="hidden sm:inline">Sonraki</span> <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
