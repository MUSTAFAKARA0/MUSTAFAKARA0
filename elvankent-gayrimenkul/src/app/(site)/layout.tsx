import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { CookieNotice, FloatingWhatsApp } from '@/components/layout/site-extras';
import { JsonLd } from '@/components/common/json-ld';
import { getSiteSettings } from '@/lib/data/settings';
import { whatsappHref } from '@/lib/contact-links';
import { organizationJsonLd } from '@/lib/seo';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  const wa = whatsappHref(settings.whatsapp ?? settings.phone, `Merhaba, ${settings.business_name} web sitesinden yazıyorum.`);

  return (
    <>
      <a
        href="#icerik"
        className="sr-only z-50 rounded-lg bg-brand-700 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        İçeriğe geç
      </a>
      <SiteHeader settings={settings} />
      <main id="icerik" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <FloatingWhatsApp href={wa} />
      <CookieNotice />
      <JsonLd data={organizationJsonLd(settings)} />
    </>
  );
}
