import type { Metadata } from 'next';
import { isIndexable } from '@/lib/site-env';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { buildSiteMetadata } from '@/modules/seo/site-metadata';
import { MaintenancePage } from '@/components/layout/site-status';
import { SiteFrame, siteRuntime } from '@/components/site/site-frame';
import { getSiteView, requireSiteTenant } from '@/site-config/load';

export async function generateMetadata({ params }: LayoutProps<'/t/[tenant]'>): Promise<Metadata> {
  // Önizlemede tenant taslak markayı, view taslak seo bölümünü taşır; yayında ikisi de canlıdır.
  // Metadata tek, saf üreticiden gelir (modules/seo/site-metadata).
  const tenant = await requireSiteTenant((await params).tenant);
  const view = await getSiteView(tenant);
  return buildSiteMetadata({
    settings: tenant.settings,
    seo: view.config.seo,
    baseUrl: tenant.baseUrl,
    indexable: isIndexable(),
    active: view.status === 'active',
    preview: view.preview,
    envVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? null,
  });
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
