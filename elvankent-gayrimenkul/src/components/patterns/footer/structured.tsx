import { FooterLinkItem, footerModel, LegalRow, SocialList, type FooterPatternInput } from '@/components/patterns/footer/parts';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Footer deseni · structured (Architectural): çizgilerle ayrılmış ızgara. Numaralı sütun
 * başlıkları (01 İlanlar · 02 Bölgeler …), künye tipi iletişim tablosu (Telefon · E-posta ·
 * Adres · Saatler), altta yasal satır. Bilgi düzenli ve hizalı.
 */
export function StructuredFooter(props: FooterPatternInput) {
  const m = footerModel(props);
  const facts = [
    m.phone && m.phoneLabel ? { k: 'Telefon', v: m.phoneLabel, href: m.phone } : null,
    m.email ? { k: 'E-posta', v: m.email, href: `mailto:${m.email}` } : null,
    m.address ? { k: 'Adres', v: m.address, href: null } : null,
    m.hours[0] ? { k: 'Saatler', v: m.hours.join(' · '), href: null } : null,
  ].filter((x): x is { k: string; v: string; href: string | null } => x !== null);
  return (
    <footer data-pattern="karay-pattern:footer/structured" className="site-footer kp-footer-structured bg-surface-inverse text-inverse-foreground">
      <div className="container-page kp-ftr-grid">
        <div className="kp-ftr-cell">
          {m.logo()}
          {m.about && <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-inverse-foreground/70">{m.about}</p>}
          <SocialList m={m} className="mt-6 flex flex-wrap gap-2" />
        </div>
        {m.columns.map((c, i) => (
          <nav key={c.id} aria-label={c.title} className="kp-ftr-cell">
            <h2 className="kp-ftr-head">
              <span className="numeric">{pad(i + 1)}</span> {c.title}
            </h2>
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
      {facts.length > 0 && (
        <dl className="container-page kp-ftr-facts">
          {facts.map((x) => (
            <div key={x.k}>
              <dt>{x.k}</dt>
              <dd>
                {x.href ? (
                  <a href={x.href} className="numeric break-all hover:text-inverse-foreground">
                    {x.v}
                  </a>
                ) : (
                  x.v
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <LegalRow m={m} className="kp-ftr-legal container-page" />
    </footer>
  );
}
