import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { JsonLd } from '@/components/common/json-ld';
import { cn } from '@/lib/utils';
import { breadcrumbJsonLd, type Crumb } from '@/modules/seo/jsonld';
import type { Tenant } from '@/platform/tenant/tenant';

export type { Crumb };

export function Breadcrumbs({ tenant, items, className, tone = 'default' }: { tenant: Tenant; items: Crumb[]; className?: string; tone?: 'default' | 'light' }) {
  return (
    <>
      <nav aria-label="Sayfa konumu" className={cn('text-[13px]', tone === 'light' ? 'text-white/70' : 'text-muted-foreground', className)}>
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${item.path}-${i}`} className="flex min-w-0 items-center gap-1">
                {last ? (
                  <span aria-current="page" className={cn('line-clamp-1 font-medium', tone === 'light' ? 'text-white' : 'text-foreground/80')}>
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.path} className={cn('transition', tone === 'light' ? 'hover:text-white' : 'hover:text-foreground')}>
                      {item.name}
                    </Link>
                    <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(tenant, items)} />
    </>
  );
}
