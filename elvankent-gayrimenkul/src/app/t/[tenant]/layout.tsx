import { hashString } from '@/lib/utils';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { CompareBar, CookieConsent, FloatingWhatsApp } from '@/components/layout/site-extras';
import { whatsappHref } from '@/lib/contact-links';
import { isIndexable } from '@/lib/site-env';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { brandingUrl } from '@/modules/media/variants';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import { MaintenancePage, PreviewBar } from '@/components/layout/site-status';
import { getSiteView } from '@/platform/site/load';
import { resolveStyle, THEMES } from '@/platform/site/themes';
import { siteCss } from '@/platform/site/tokens';
import { requireTenant } from '@/platform/tenant/tenant';

export async function generateMetadata({ params }: LayoutProps<'/t/[tenant]'>): Promise<Metadata> {
  const tenant = await requireTenant((await params).tenant);
  const view = await getSiteView(tenant);
  const s = tenant.settings;
  const seo = view.config.seo;
  const name = s.display_name;
  // Site SEO (KARAY Web Sitesi Yönetimi) → ofisin SEO ayarları → varsayılan
  const noindex = !isIndexable() || seo.robots === 'noindex' || view.status !== 'active' || view.preview;
  const description =
    seo.description ??
    s.seo_description ??
    s.description ??
    `${name}: ${s.service_area ? `${s.service_area} ` : ''}satılık ve kiralık daire, villa, ticari gayrimenkul ve arsa ilanları.`;
  const favicon = brandingUrl(s.favicon_url);
  const og = siteOgImage(tenant);
  return {
    metadataBase: new URL(tenant.baseUrl),
    title: { default: seo.title ?? s.seo_title ?? `${name} | Satılık ve kiralık gayrimenkuller`, template: `%s | ${name}` },
    description,
    applicationName: name,
    openGraph: { type: 'website', ...baseOpenGraph(tenant), images: [og] },
    twitter: { card: 'summary_large_image', images: [og] },
    manifest: '/manifest.webmanifest',
    // Demo / önizleme ortamı arama motorlarına kapalıdır (ayrıca X-Robots-Tag başlığı)
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    // Ofisin yüklediği simge; yoksa ofis adından ve renginden üretilen otomatik simge
    icons: favicon ? { icon: favicon, apple: favicon } : { icon: { url: '/site-icon', type: 'image/svg+xml' }, apple: '/site-icon/apple' },
    verification: {
      google: s.google_site_verification ?? process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? undefined,
    },
  };
}

export default async function TenantLayout({ children, params }: LayoutProps<'/t/[tenant]'>) {
  const tenant = await requireTenant((await params).tenant);
  const [posts, regions, view] = await Promise.all([getPublishedPosts(tenant.id, 1), getRegionPages(tenant.id), getSiteView(tenant)]);
  const s = tenant.settings;
  // Tema + palet + tipografi → CSS değişkenleri (yalnızca doğrulanmış değerler)
  const css = siteCss(view.config, s, view.features.darkMode);
  const theme = THEMES[view.config.theme];
  const style = resolveStyle(view.config);
  const hasBlog = posts.length > 0 && view.features.blog;
  // Anahtar içerikten türetilir: ofis rengini değiştirdiğinde (sürüm aynı kalsa da) yeni stil yüklenir
  const styleKey = `site-${tenant.id}-${view.preview ? 'onizleme' : tenant.site.version}-${hashString(css)}`;

  // Bakım / yayında değil: ziyaretçiye bakım sayfası (panel ve önizleme etkilenmez)
  if (view.status !== 'active' && !view.preview) {
    return (
      <>
        <style href={styleKey} precedence="high">
          {css}
        </style>
        <MaintenancePage tenant={tenant} status={view.status} message={view.maintenanceMessage} />
      </>
    );
  }

  return (
    <div data-site-theme={theme.id} data-site-card={style.card} data-site-button={style.button} data-site-footer={style.footer} className="contents">
      <style href={styleKey} precedence="high">
        {css}
      </style>
      {view.preview && <PreviewBar />}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        İçeriğe geç
      </a>
      <SiteHeader tenant={tenant} hasBlog={hasBlog} view={view} />
      <main id="icerik" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter tenant={tenant} regions={regions.map((r) => ({ slug: r.slug, name: r.name }))} hasBlog={hasBlog} view={view} />
      {view.features.whatsapp && <FloatingWhatsApp href={whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.')} />}
      {view.features.favorites && <CompareBar />}
      <CookieConsent />
    </div>
  );
}
