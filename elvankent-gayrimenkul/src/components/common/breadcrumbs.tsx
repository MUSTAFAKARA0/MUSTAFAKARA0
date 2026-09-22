import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { JsonLd } from './json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';

export interface Crumb {
  name: string;
  path: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Sayfa konumu" className="text-[13px] text-sand-500">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.path} className="flex min-w-0 items-center gap-1">
                {last ? (
                  <span aria-current="page" className="truncate font-medium text-sand-700">
                    {item.name}
                  </span>
                ) : (
                  <>
                    <Link href={item.path} className="transition hover:text-brand-700">
                      {item.name}
                    </Link>
                    <ChevronRight className="size-3.5 shrink-0 text-sand-300" aria-hidden />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbJsonLd(items)} />
    </>
  );
}
