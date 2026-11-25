import { cn } from '@/lib/utils';

/** Uzun ayar sayfaları için sayfa içi bölüm gezintisi (bağlantılar #id'ye gider; Panel'ler scroll-mt taşır) */
export function SectionNav({ items, className }: { items: { id: string; label: string }[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Bu sayfadaki bölümler" className={cn('tab-strip scrollbar-none -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      <ul className="flex min-w-max gap-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-[13px] font-semibold text-muted-foreground transition hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-9"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
