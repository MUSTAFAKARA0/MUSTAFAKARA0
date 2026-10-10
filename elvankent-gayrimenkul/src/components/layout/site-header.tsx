import { Logo } from '@/components/brand/logo';
import { HeaderActions, DesktopNav, MobileMenu } from '@/components/layout/header-client';
import { isHrefAvailable, resolveNav } from '@/site-config/nav';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { brandingUrl } from '@/modules/media/variants';
import type { SiteView } from '@/site-config/load';
import type { Tenant } from '@/platform/tenant/tenant';

/**
 * Site başlığı: menü, telefon/WhatsApp, çağrı düğmesi ve görünüm KARAY Web Sitesi
 * Yönetimi'nden (Header + Menü) gelir; ayar yoksa varsayılan başlık. Düzen sitenin tasarım
 * manifestinden gelir: classic (varsayılan) · centered (ortalı logo, ayrı menü satırı) ·
 * floating (ayrık, yarı saydam; yalnızca CSS — Theme Engine › design-css.ts).
 */
export function SiteHeader({ tenant, hasBlog, view }: { tenant: Tenant; hasBlog: boolean; view: SiteView }) {
  const s = tenant.settings;
  const h = view.config.header;
  const nav = resolveNav(view, hasBlog);
  const phone = telHref(s.phone);
  const whatsapp = view.features.whatsapp ? whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.') : null;
  // Header zemini: Header ayarı boşsa temanın varsayılanı
  const headerStyle = view.style.header;
  const dark = headerStyle === 'dark';
  const cta = h.cta && isHrefAvailable(h.cta.href, view, hasBlog) ? h.cta : null;
  const mobileLogo = brandingUrl(s.logo_mobile_url);
  const logo = (className: string) => (
    <Logo
      name={s.display_name}
      logoUrl={brandingUrl(s.logo_url)}
      mobileLogoUrl={mobileLogo}
      tone={dark ? 'light' : 'dark'}
      display={h.brand}
      tagline={h.showTagline ? s.tagline : null}
      className={className}
    />
  );
  const actions = (
    <div className="flex shrink-0 items-center justify-self-end gap-1 sm:gap-2">
      <HeaderActions
        phoneHref={h.showPhone ? phone : null}
        phoneLabel={h.showPhone && s.phone ? formatPhoneDisplay(s.phone) : null}
        whatsappHref={h.showWhatsapp ? whatsapp : null}
        mobilePhoneHref={h.mobile.showPhone ? phone : null}
        showFavorites={h.showFavorites && view.features.favorites}
        cta={cta}
      />
      <MobileMenu
        items={nav}
        name={s.display_name}
        phoneHref={phone}
        phoneLabel={s.phone ? formatPhoneDisplay(s.phone) : null}
        whatsappHref={h.mobile.showWhatsapp ? whatsapp : null}
        showFavorites={view.features.favorites}
        address={[s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ') || null}
      />
    </div>
  );
  const headerClass = cn(
    'site-header top-0 z-40 border-b border-border/80 bg-surface/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-surface/85',
    h.sticky ? 'sticky' : 'relative',
  );

  // Ortalı logo (editoryal): üst satırda konum · logo · aksiyonlar, altta ayrı menü satırı.
  // Telefonda klasik düzenle aynıdır (marka + aksiyonlar + menü düğmesi).
  if (view.style.headerLayout === 'centered') {
    const area = [s.address_district, s.address_city].filter(Boolean).join(', ') || s.service_area;
    return (
      <header data-header-style={headerStyle} className={headerClass}>
        <div className="site-header-bar container-page">
          <div className={cn('flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6', h.height === 'compact' ? 'h-14 lg:h-16' : 'h-16 lg:h-[76px]')}>
            <p className="hidden truncate text-[12px] font-semibold tracking-[0.16em] text-muted-foreground uppercase lg:block">{area}</p>
            {logo('max-w-full justify-self-start lg:justify-self-center')}
            {actions}
          </div>
          <div className="hidden h-14 items-center justify-center border-t border-border/70 lg:flex">
            <DesktopNav items={nav} placement="row" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header data-header-style={headerStyle} className={headerClass}>
      {/* Üç bölge: marka (sol) · menü (tam ortada) · aksiyonlar (sağ). Telefonda marka + aksiyonlar + menü düğmesi. */}
      <div
        className={cn(
          'site-header-bar container-page flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6',
          h.height === 'compact' ? 'h-14 lg:h-16' : 'h-16 lg:h-[78px]',
        )}
      >
        {logo('max-w-full justify-self-start')}
        <DesktopNav items={nav} />
        {actions}
      </div>
    </header>
  );
}
