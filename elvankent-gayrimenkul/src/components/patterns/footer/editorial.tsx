import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FooterLinkItem, footerModel, LegalRow, SocialList, type FooterPatternInput } from '@/components/patterns/footer/parts';

/**
 * Footer deseni · editorial (Luxury): büyük marka cümlesi ve tek çağrı; bağlantılar tek sade
 * satırda (sütun yığını yok). İletişim satır içi, yasal satır en altta. Az ama etkili.
 */
export function EditorialFooter(props: FooterPatternInput) {
  const m = footerModel(props);
  const links = m.columns.flatMap((c) => c.links).slice(0, 8);
  return (
    <footer data-pattern="karay-pattern:footer/editorial" className="site-footer kp-footer-editorial bg-surface-inverse text-inverse-foreground">
      <div className="container-page kp-ftr-hero">
        {m.logo()}
        <p className="kp-ftr-statement font-display text-inverse-foreground">{m.about ?? m.s.display_name}</p>
        {m.contactHref && (
          <Link href={m.contactHref} className="kp-ftr-cta">
            Bizimle görüşün <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <div className="container-page kp-ftr-line">
        <nav aria-label="Alt menü">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {links.map((l, i) => (
              <li key={`${i}-${l.href}`}>
                <FooterLinkItem l={l} className="kp-ftr-link" />
              </li>
            ))}
          </ul>
        </nav>
        {(m.phoneLabel || m.email || m.address) && (
          <ul className="kp-ftr-contact">
            {m.phone && m.phoneLabel && (
              <li>
                <a href={m.phone} className="numeric hover:text-inverse-foreground">
                  {m.phoneLabel}
                </a>
              </li>
            )}
            {m.email && (
              <li>
                <a href={`mailto:${m.email}`} className="break-all hover:text-inverse-foreground">
                  {m.email}
                </a>
              </li>
            )}
            {m.address && <li>{m.address}</li>}
          </ul>
        )}
        <SocialList m={m} className="flex flex-wrap justify-center gap-2" />
      </div>
      <LegalRow m={m} className="kp-ftr-legal container-page" />
    </footer>
  );
}
