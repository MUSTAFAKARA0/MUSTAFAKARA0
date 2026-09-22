import { Phone } from 'lucide-react';
import { Logo } from './logo';
import { DesktopNav, FavoritesLink, MobileMenu } from './header-client';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatPhoneDisplay } from '@/lib/format';
import type { SiteSettings } from '@/types/database';

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  const tel = telHref(settings.phone);
  const wa = whatsappHref(settings.whatsapp ?? settings.phone, `Merhaba, ${settings.business_name} web sitesinden yazıyorum.`);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/92 backdrop-blur-md supports-[backdrop-filter]:bg-surface/85">
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Logo businessName={settings.business_name} logoUrl={settings.logo_url} />
        <DesktopNav />
        <div className="flex items-center gap-1">
          <FavoritesLink />
          {tel && (
            <a
              href={tel}
              className="ml-1 hidden items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 md:inline-flex"
            >
              <Phone className="size-4" aria-hidden />
              <span className="hidden xl:inline">{formatPhoneDisplay(settings.phone)}</span>
              <span className="xl:hidden">Bizi Arayın</span>
            </a>
          )}
          <MobileMenu tel={tel} whatsapp={wa} businessName={settings.business_name} />
        </div>
      </div>
    </header>
  );
}
