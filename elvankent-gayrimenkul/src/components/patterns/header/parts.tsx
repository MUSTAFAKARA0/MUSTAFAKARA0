import { Logo } from '@/components/brand/logo';
import { HeaderActions, MobileMenu } from '@/components/layout/header-client';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { brandingUrl } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import { isHrefAvailable, resolveNav } from '@/site-config/nav';

/**
 * Header desenlerinin ORTAK verisi ve yapı taşları (D7.4). Menü, logo, telefon/WhatsApp ve
 * çağrı düğmesi KARAY Web Sitesi Yönetimi'ndeki Header + Menü ayarlarından gelir — mevcut
 * SiteHeader ile AYNI kurallar. Desenler yalnızca yerleşimi değiştirir; istemci parçaları
 * (menü paneli, favoriler) mevcut header-client bileşenleridir (yeni tarayıcı kodu yok).
 */
export interface HeaderPatternInput {
  tenant: Tenant;
  view: SiteView;
  hasBlog: boolean;
}

export function headerModel({ tenant, view, hasBlog }: HeaderPatternInput) {
  const s = tenant.settings;
  const h = view.config.header;
  const phone = telHref(s.phone);
  const whatsapp = view.features.whatsapp ? whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.') : null;
  const cta = h.cta && isHrefAvailable(h.cta.href, view, hasBlog) ? h.cta : null;
  const nav = resolveNav(view, hasBlog);
  const address = [s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ') || null;
  return {
    s,
    h,
    nav,
    phone,
    phoneLabel: s.phone ? formatPhoneDisplay(s.phone) : null,
    whatsapp,
    cta,
    address,
    contactHref: isHrefAvailable('/iletisim', view, hasBlog) ? '/iletisim' : null,
    logo: (className: string, tone: 'dark' | 'light' = 'dark') => (
      <Logo
        name={s.display_name}
        logoUrl={brandingUrl(s.logo_url)}
        mobileLogoUrl={brandingUrl(s.logo_mobile_url)}
        tone={tone}
        display={h.brand}
        tagline={h.showTagline ? s.tagline : null}
        className={className}
      />
    ),
    /** Telefon, WhatsApp, favoriler, karşılaştırma, çağrı (compact: yalnızca favoriler + çağrı) */
    quick: (opts: { compact?: boolean } = {}) => (
      <HeaderActions
        phoneHref={!opts.compact && h.showPhone ? phone : null}
        phoneLabel={!opts.compact && h.showPhone && s.phone ? formatPhoneDisplay(s.phone) : null}
        whatsappHref={!opts.compact && h.showWhatsapp ? whatsapp : null}
        mobilePhoneHref={h.mobile.showPhone ? phone : null}
        showFavorites={h.showFavorites && view.features.favorites}
        cta={cta}
      />
    ),
    /** Menü paneli (telefonda; transparent desende her ekranda) */
    menu: () => (
      <MobileMenu
        items={nav}
        name={s.display_name}
        phoneHref={phone}
        phoneLabel={s.phone ? formatPhoneDisplay(s.phone) : null}
        whatsappHref={h.mobile.showWhatsapp ? whatsapp : null}
        showFavorites={view.features.favorites}
        address={address}
      />
    ),
  };
}
