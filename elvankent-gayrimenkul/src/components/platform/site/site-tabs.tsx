'use client';

import { usePathname } from 'next/navigation';
import Link from '@/components/common/intent-link';
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

/** Site Kontrol Merkezi sekmeleri (telefonda yatay kaydırılır; sayfa taşmaz) */
export function SiteTabs({ orgId, customized }: { orgId: string; customized: string[] }) {
  const pathname = usePathname();
  const base = `/platform/siteler/${orgId}`;
  return (
    <nav aria-label="Site ayarları" className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {SITE_TABS.map((t) => {
          const href = t.slug ? `${base}/${t.slug}` : base;
          const active = t.slug ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={t.slug || 'genel'}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {customized.includes(t.slug) && <span className="size-1.5 rounded-full bg-accent" aria-label="(özelleştirildi)" />}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
