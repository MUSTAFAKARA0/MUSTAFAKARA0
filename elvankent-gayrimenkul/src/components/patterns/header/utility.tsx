import { Clock, MessageCircle, Phone } from 'lucide-react';
import { DesktopNav } from '@/components/layout/header-client';
import { headerModel, type HeaderPatternInput } from '@/components/patterns/header/parts';
import { cn } from '@/lib/utils';
import { formatOpeningHours, parseOpeningHours } from '@/modules/content/hours';

/**
 * Header deseni · utility (Kurumsal Zincir, Kiralık Merkezi): iki katlı. Üstte ince yardımcı
 * şerit (telefon · WhatsApp · çalışma saatleri; yalnızca KARAY Web Sitesi Yönetimi'nde dolu
 * olanlar), altında logo · menü · aksiyonlar. Şerit telefonda yalnızca telefon bağlantısını
 * gösterir. Başlık açık/koyu kararı temadan gelir (data-header-style). Yeni tarayıcı kodu yok.
 */
export function UtilityHeader(props: HeaderPatternInput) {
  const m = headerModel(props);
  const dark = props.view.style.header === 'dark';
  const hours = formatOpeningHours(parseOpeningHours(m.s.opening_hours))[0] ?? null;
  const items = [
    m.phone && m.phoneLabel ? { key: 'tel', icon: Phone, text: m.phoneLabel, href: m.phone, label: 'Telefon' } : null,
    m.whatsapp ? { key: 'wa', icon: MessageCircle, text: 'WhatsApp', href: m.whatsapp, label: 'WhatsApp ile yazın' } : null,
    hours ? { key: 'hours', icon: Clock, text: hours, href: null, label: 'Çalışma saatleri' } : null,
  ].filter((x): x is { key: string; icon: typeof Phone; text: string; href: string | null; label: string } => x !== null);
  return (
    <header
      data-pattern="karay-pattern:header/utility"
      data-header-style={props.view.style.header}
      className={cn('site-header kp-header-utility top-0 z-40 bg-surface text-foreground', m.h.sticky ? 'sticky' : 'relative')}
    >
      {items.length > 0 && (
        <div className="kp-util-bar">
          <ul className="container-page flex items-center gap-x-5 gap-y-1">
            {items.map(({ key, icon: Icon, text, href, label }) => (
              <li key={key} className={cn('kp-util-item min-w-0', key !== 'tel' && 'kp-util-extra')}>
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {href ? (
                  <a href={href} aria-label={`${label}: ${text}`} className={cn('truncate hover:text-foreground', key === 'tel' && 'numeric')} {...(key === 'wa' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
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
      <div className="site-header-bar kp-util-main container-page">
        {m.logo('max-w-full justify-self-start', dark ? 'light' : 'dark')}
        <div className="kp-util-nav">
          <DesktopNav items={m.nav} />
        </div>
        <div className="kp-util-actions">
          {m.quick({ compact: true })}
          {m.menu()}
        </div>
      </div>
    </header>
  );
}
