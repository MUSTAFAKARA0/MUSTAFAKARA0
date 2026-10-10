import { Mail, MapPin, Phone } from 'lucide-react';
import { DesktopNav } from '@/components/layout/header-client';
import { headerModel, type HeaderPatternInput } from '@/components/patterns/header/parts';
import { cn } from '@/lib/utils';

/**
 * Header deseni · structured (Architectural): iki katlı, çizgilerle bölünmüş ızgara. Üstte ince
 * künye şeridi (adres · telefon · e-posta — yalnızca dolu olanlar), altta hücrelere ayrılmış ana
 * satır: logo hücresi · menü · aksiyonlar. Düzenli ve kurumsal; süs yok.
 */
export function StructuredHeader(props: HeaderPatternInput) {
  const m = headerModel(props);
  const s = m.s;
  const info = [
    m.address ? { icon: MapPin, text: m.address, href: null } : null,
    m.phone && m.phoneLabel ? { icon: Phone, text: m.phoneLabel, href: m.phone } : null,
    s.email ? { icon: Mail, text: s.email, href: `mailto:${s.email}` } : null,
  ].filter((x): x is { icon: typeof Phone; text: string; href: string | null } => x !== null);
  return (
    <header data-pattern="karay-pattern:header/structured" className={cn('site-header kp-header-structured top-0 z-40 bg-surface text-foreground', m.h.sticky ? 'sticky' : 'relative')}>
      {info.length > 0 && (
        <div className="kp-hdr-strip">
          <ul className="container-page flex overflow-hidden">
            {info.map(({ icon: Icon, text, href }) => (
              <li key={text} className="kp-hdr-cell min-w-0">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {href ? (
                  <a href={href} className="numeric truncate hover:text-foreground">
                    {text}
                  </a>
                ) : (
                  <span className="truncate">{text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="kp-hdr-main container-page">
        <div className="kp-hdr-brand">{m.logo('max-w-full')}</div>
        <div className="kp-hdr-nav">
          <DesktopNav items={m.nav} />
        </div>
        <div className="kp-hdr-actions">
          {m.quick()}
          {m.menu()}
        </div>
      </div>
    </header>
  );
}
