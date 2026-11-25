import Link from 'next/link';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { FooterLinkItem, footerModel, LegalRow, SocialList, type FooterPatternInput } from '@/components/patterns/footer/parts';

/**
 * Footer deseni · band (Kurumsal Zincir): tam genişlik marka bandı (tek çağrı: iletişim sayfası,
 * telefon veya WhatsApp — yalnızca KARAY Web Sitesi Yönetimi'nde tanımlı olanlar) ve altında
 * dört sütunlu footer: marka + iletişim, ardından menü sütunları. Bantta uydurma vaat yok.
 */
export function BandFooter(props: FooterPatternInput) {
  const m = footerModel(props);
  const columns = m.columns.slice(0, 3);
  const hasCta = Boolean(m.contactHref || m.phone || m.whatsapp);
  return (
    <footer data-pattern="karay-pattern:footer/band" className="site-footer kp-footer-band bg-surface-inverse text-inverse-foreground">
      {hasCta && (
        <div className="kp-band">
          <div className="container-page kp-band-inner">
            <p className="kp-band-title font-display">{m.s.display_name} ile görüşün</p>
            <div className="kp-band-actions">
              {m.contactHref && (
                <Link href={m.contactHref} className="kp-band-cta">
                  İletişime geçin <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
              {m.phone && m.phoneLabel && (
                <a href={m.phone} className="kp-band-link numeric">
                  <Phone className="size-4" aria-hidden /> {m.phoneLabel}
                </a>
              )}
              {m.whatsapp && (
                <a href={m.whatsapp} target="_blank" rel="noopener noreferrer" className="kp-band-link">
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="container-page kp-ftr-cols">
        <div>
          {m.logo()}
          {m.about && <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-inverse-foreground/70">{m.about}</p>}
          {(m.email || m.address) && (
            <ul className="mt-5 space-y-1.5 text-[14px] text-inverse-foreground/75">
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
          <SocialList m={m} className="mt-6 flex flex-wrap gap-2" />
        </div>
        {columns.map((c) => (
          <nav key={c.id} aria-label={c.title}>
            <h2 className="kp-ftr-head">{c.title}</h2>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.href + l.label}>
                  <FooterLinkItem l={l} className="kp-ftr-link" />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <LegalRow m={m} className="kp-ftr-legal container-page" />
    </footer>
  );
}
