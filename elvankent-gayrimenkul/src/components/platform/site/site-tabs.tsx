'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Link from '@/components/common/intent-link';
import { confirmLeave } from '@/components/platform/site/dirty-guard';
import { cn } from '@/lib/utils';

export const SITE_TABS = [
  { slug: '', label: 'Genel' },
  { slug: 'marka', label: 'Marka' },
  { slug: 'tema', label: 'Tema' },
  { slug: 'renkler', label: 'Renkler' },
  { slug: 'tipografi', label: 'Tipografi' },
  { slug: 'header', label: 'Header' },
  { slug: 'ana-sayfa', label: 'Ana Sayfa' },
  { slug: 'sayfalar', label: 'Sayfalar' },
  { slug: 'menu', label: 'Menü' },
  { slug: 'footer', label: 'Footer' },
  { slug: 'seo', label: 'SEO' },
  { slug: 'alan-adi', label: 'Domain' },
  { slug: 'ozellikler', label: 'Özellikler' },
  { slug: 'gecmis', label: 'Geçmiş' },
] as const;

/**
 * Site Kontrol Merkezi sekmeleri. Etkin sekme dolgulu; yayınlanmamış değişikliği olan
 * sekmede turuncu nokta. Telefonda yatay kaydırılır (sayfa taşmaz) ve etkin sekme
 * görünür alana kaydırılır. Kaydedilmemiş form varken sekme değiştirmek onay ister.
 */
export function SiteTabs({ orgId, pending }: { orgId: string; pending: string[] }) {
  const pathname = usePathname();
  const base = `/platform/siteler/${orgId}`;
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pathname]);
  return (
    <nav aria-label="Site ayarları" className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-2xl border border-border bg-surface p-1 shadow-xs">
        {SITE_TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const active = t.slug ? pathname.startsWith(href) : pathname === base;
          const isPending = pending.includes(t.slug);
          return (
            <li key={t.slug || 'genel'}>
              <Link
                ref={active ? activeRef : undefined}
                href={href}
                onClick={confirmLeave}
                aria-current={active ? 'page' : undefined}
                title={isPending ? 'Bu bölümde yayınlanmamış değişiklik var' : undefined}
                className={cn(
                  'relative inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                  active ? 'bg-primary text-primary-fg shadow-sm' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                )}
              >
                {t.label}
                {isPending && (
                  <span className={cn('size-2 rounded-full', active ? 'bg-amber-300' : 'bg-amber-500')}>
                    <span className="sr-only"> (yayınlanmamış değişiklik)</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
