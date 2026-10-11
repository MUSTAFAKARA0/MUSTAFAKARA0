import type { Metadata } from 'next';
import { JsonLd } from '@/components/common/json-ld';
import { SiteHome } from '@/components/site/site-home';
import { getPublishedPosts, getRegionPages } from '@/modules/content/queries';
import { getInventoryCounts, getLatestProperties, getRegionCounts, getShowcaseProperties } from '@/modules/properties/queries';
import { getSearchOptions } from '@/modules/properties/search-options';
import { organizationJsonLd, websiteJsonLd } from '@/modules/seo/jsonld';
import { getSiteView, requireSiteTenant } from '@/site-config/load';

export const revalidate = 300;

export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage({ params }: PageProps<'/t/[tenant]'>) {
  const tenant = await requireSiteTenant((await params).tenant);
  const [showcase, latestPool, inventory, options, regions, regionCounts, posts] = await Promise.all([
    getShowcaseProperties(tenant.id, 4),
    getLatestProperties(tenant.id, 24),
    getInventoryCounts(tenant.id),
    getSearchOptions(tenant.id),
    getRegionPages(tenant.id),
    getRegionCounts(tenant.id),
    getPublishedPosts(tenant.id, 3),
  ]);

  const view = await getSiteView(tenant);
  const seo = view.config.seo;
  return (
    <>
      <JsonLd data={[organizationJsonLd(tenant, view.features.advancedSeo ? seo : undefined), websiteJsonLd(tenant)]} />
      <SiteHome tenant={tenant} view={view} data={{ showcase, latestPool, inventory, options, regions, regionCounts, posts }} />
    </>
  );
}
