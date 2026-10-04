import Link from 'next/link';
import { MapPin, Phone } from 'lucide-react';
import { FooterLinkItem, footerModel, LegalRow, SocialList, type FooterPatternInput } from '@/components/patterns/footer/parts';

/**
 * Footer deseni · discovery (Map First): kompakt keşif. Üstte bölge kısayolları (sitenin bölge
 * sayfaları) ve ilan türü bağlantıları — kullanıcı sayfanın sonunda da aramaya döner; ardından
 * tek satır iletişim ve yasal satır. Uzun sütun yığını yok.
 */
export function DiscoveryFooter(props: FooterPatternInput) {
  const m = footerModel(props);
  const listing = m.columns.find((c) => c.id === 'ilanlar')?.links ?? m.columns[0]?.links ?? [];
  const regions = props.regions.slice(0, 10);
  const others = m.columns.filter((c) => c.id !== 'ilanlar' && c.id !== 'bolgeler').flatMap((c) => c.links).slice(0, 6);
  return (
    <footer data-pattern="karay-pattern:footer/discovery" className="site-footer kp-footer-discovery bg-surface-inverse text-inverse-foreground">
      <div className="container-page kp-ftr-discover">
        <div className="min-w-0">
          <h2 className="kp-ftr-head">Bölgelere göre ilanlar</h2>
          {regions.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <li key={r.slug}>
                  <Link href={`/bolgeler/${r.slug}`} className="kp-ftr-chip">
                    <MapPin className="size-3.5" aria-hidden /> {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/ilanlar" className="kp-ftr-chip">
              <MapPin className="size-3.5" aria-hidden /> Bütün ilanlar haritada
            </Link>
          )}
        </div>
        <nav aria-label="İlanlar" className="min-w-0">
          <h2 className="kp-ftr-head">İlan türleri</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
            {listing.map((l) => (
              <li key={l.href + l.label}>
                <FooterLinkItem l={l} className="kp-ftr-link" />
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="container-page kp-ftr-bar">
        {m.logo()}
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          {m.phone && m.phoneLabel && (
            <li>
              <a href={m.phone} className="numeric inline-flex items-center gap-1.5 hover:text-inverse-foreground">
                <Phone className="size-4" aria-hidden /> {m.phoneLabel}
              </a>
            </li>
          )}
          {others.map((l, i) => (
            <li key={`${i}-${l.href}`}>
              <FooterLinkItem l={l} className="kp-ftr-link" />
            </li>
          ))}
        </ul>
        <SocialList m={m} />
      </div>
      <LegalRow m={m} className="kp-ftr-legal container-page" />
    </footer>
  );
}
