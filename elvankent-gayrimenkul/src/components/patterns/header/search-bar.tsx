import Link from 'next/link';
import { Map as MapIcon, Search } from 'lucide-react';
import { headerModel, type HeaderPatternInput } from '@/components/patterns/header/parts';
import { cn } from '@/lib/utils';

/**
 * Header deseni · search-bar (Map First): arama her sayfada bir dokunuş uzakta. Header'ın
 * ortasında serbest metin araması (ilan no veya semt/ilan adı) — düz HTML formu, /ilanlar?q=
 * adresine gider (mevcut arama sözleşmesi; JavaScript gerekmez). Altında hızlı keşif satırı:
 * Satılık · Kiralık · Haritada ara. Telefonda arama kutusu ikinci satırdadır.
 */
export function SearchBarHeader(props: HeaderPatternInput) {
  const m = headerModel(props);
  const form = (id: string, className: string) => (
    <form action="/ilanlar" method="get" role="search" className={cn('kp-hdr-search', className)}>
      <label htmlFor={id} className="sr-only">
        İlan ara
      </label>
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input id={id} name="q" type="search" maxLength={60} placeholder="Semt, ilan adı veya ilan no" className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
      <button type="submit" className="kp-hdr-search-go">
        Ara
      </button>
    </form>
  );
  return (
    <header data-pattern="karay-pattern:header/search-bar" className={cn('site-header kp-header-search top-0 z-40 border-b border-border bg-surface text-foreground', m.h.sticky ? 'sticky' : 'relative')}>
      <div className="kp-hdr-row container-page">
        {m.logo('max-w-full shrink-0')}
        {form('kp-hdr-q', 'kp-hdr-search-desk')}
        <div className="kp-hdr-actions">
          {m.quick({ compact: true })}
          {m.menu()}
        </div>
      </div>
      <div className="container-page kp-hdr-mobile-search">{form('kp-hdr-q-m', '')}</div>
      <nav aria-label="Hızlı keşif" className="kp-hdr-quick">
        <ul className="container-page flex items-center gap-1 overflow-x-auto">
          {[
            { href: '/satilik', label: 'Satılık' },
            { href: '/kiralik', label: 'Kiralık' },
            ...m.nav.filter((i) => !['/satilik', '/kiralik', '/', '/ilanlar'].includes(i.href)).slice(0, 4),
          ].map((i) => (
            <li key={i.href + i.label}>
              <Link href={i.href} className="kp-hdr-quick-link">
                {i.label}
              </Link>
            </li>
          ))}
          <li className="ml-auto">
            <Link href="/ilanlar" className="kp-hdr-quick-link kp-hdr-quick-map">
              <MapIcon className="size-4" aria-hidden /> Haritada ara
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
