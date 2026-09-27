import { Logo } from '@/components/layout/logo';
import { HeaderActions, DesktopNav, MobileMenu } from '@/components/layout/header-client';
import { mainNav } from '@/components/layout/nav';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import { brandingUrl } from '@/modules/media/variants';
import type { Tenant } from '@/platform/tenant/tenant';

export function SiteHeader({ tenant, hasBlog }: { tenant: Tenant; hasBlog: boolean }) {
  const s = tenant.settings;
  const nav = mainNav(hasBlog);
  const phone = telHref(s.phone);
  const whatsapp = whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.');
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[76px]">
        <Logo name={s.display_name} logoUrl={brandingUrl(s.logo_url)} />
        <DesktopNav items={nav} />
        <div className="flex items-center gap-1 sm:gap-2">
          <HeaderActions phoneHref={phone} phoneLabel={s.phone ? formatPhoneDisplay(s.phone) : null} />
          <MobileMenu
            items={nav}
            name={s.display_name}
            phoneHref={phone}
            phoneLabel={s.phone ? formatPhoneDisplay(s.phone) : null}
            whatsappHref={whatsapp}
            address={[s.address_line, s.address_district, s.address_city].filter(Boolean).join(', ') || null}
          />
        </div>
      </div>
    </header>
  );
}
