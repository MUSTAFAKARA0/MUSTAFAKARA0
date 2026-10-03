import { Logo } from '@/components/brand/logo';
import { HeaderActions, DesktopNav, MobileMenu } from '@/components/layout/header-client';
import { isHrefAvailable, resolveNav } from '@/site-config/nav';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { brandingUrl } from '@/modules/media/variants';
import type { SiteView } from '@/site-config/load';
import { resolveStyle } from '@/theme-engine/themes';
import type { Tenant } from '@/platform/tenant/tenant';

/**
 * Site başlığı: menü, telefon/WhatsApp, çağrı düğmesi ve görünüm KARAY Web Sitesi
 * Yönetimi'nden (Header + Menü) gelir; ayar yoksa varsayılan başlık.
 */
export function SiteHeader({ tenant, hasBlog, view }: { tenant: Tenant; hasBlog: boolean; view: SiteView }) {
  const s = tenant.settings;
  const h = view.config.header;
  const nav = resolveNav(view, hasBlog);
  const phone = telHref(s.phone);
  const whatsapp = view.features.whatsapp ? whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.') : null;
  // Header zemini: Header ayarı boşsa temanın varsayılanı
  const headerStyle = resolveStyle(view.config).header;
  const dark = headerStyle === 'dark';
  const cta = h.cta && isHrefAvailable(h.cta.href, view, hasBlog) ? h.cta : null;
  const mobileLogo = brandingUrl(s.logo_mobile_url);
  return (
    <header
      data-header-style={headerStyle}
      className={cn(
        'top-0 z-40 border-b border-border/80 bg-surface/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-surface/85',
        h.sticky ? 'sticky' : 'relative',
      )}
    >
      {/* Üç bölge: marka (sol) · menü (tam ortada) · aksiyonlar (sağ). Telefonda marka + aksiyonlar + menü düğmesi. */}
      <div
        className={cn(
          'container-page flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6',
          h.height === 'compact' ? 'h-14 lg:h-16' : 'h-16 lg:h-[78px]',
        )}
      >
        <Logo
          name={s.display_name}
          logoUrl={brandingUrl(s.logo_url)}
          mobileLogoUrl={mobileLogo}
          tone={dark ? 'light' : 'dark'}
          display={h.brand}
          tagline={h.showTagline ? s.tagline : null}
          className="max-w-full justify-self-start"
        />
        <DesktopNav items={nav} />
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
      </div>
    </header>
  );
}
