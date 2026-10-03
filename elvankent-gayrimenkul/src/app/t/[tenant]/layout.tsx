import type { Metadata } from 'next';
import { isIndexable } from '@/lib/site-env';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { brandingUrl } from '@/modules/media/variants';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import { MaintenancePage } from '@/components/layout/site-status';
import { SiteFrame, siteRuntime } from '@/components/site/site-frame';
import { getSiteView, requireSiteTenant } from '@/site-config/load';

export async function generateMetadata({ params }: LayoutProps<'/t/[tenant]'>): Promise<Metadata> {
  const tenant = await requireSiteTenant((await params).tenant);
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
  const tenant = await requireSiteTenant((await params).tenant);
  const [posts, regions, view] = await Promise.all([getPublishedPosts(tenant.id, 1), getRegionPages(tenant.id), getSiteView(tenant)]);
  // Site Engine görsel sistemi kendisi çözmez: tema verisi (theme_id + ayarlar) Theme Engine'e
  // verilir (siteRuntime); dönen CSS, yazı tipi paketi ve öznitelikler olduğu gibi uygulanır.
  const version = view.preview ? 'onizleme' : tenant.site.version;
  const hasBlog = posts.length > 0 && view.features.blog;

  // Bakım / yayında değil: ziyaretçiye bakım sayfası (panel ve önizleme etkilenmez)
  if (view.status !== 'active' && !view.preview) {
    return (
      <>
        {siteRuntime(tenant, view, version).head}
        <MaintenancePage tenant={tenant} status={view.status} message={view.maintenanceMessage} />
      </>
    );
  }

  return (
    <SiteFrame tenant={tenant} view={view} hasBlog={hasBlog} regions={regions.map((r) => ({ slug: r.slug, name: r.name }))} version={version}>
      {children}
    </SiteFrame>
  );
}
