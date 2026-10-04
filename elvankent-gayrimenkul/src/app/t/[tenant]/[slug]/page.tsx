import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteListing } from '@/components/site/site-listing';
import { getRegionPages } from '@/modules/content/queries';
import { countActiveFilters, listingHref, listingQueryToParams, parseListingQuery } from '@/modules/properties/filters';
import { findRedirect, searchProperties } from '@/modules/properties/queries';
import { followRedirect } from '@/modules/seo/redirects';
import { resolveListingRoute } from '@/modules/properties/routes';
import { getSearchOptions } from '@/modules/properties/search-options';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import { getSiteView, requireSiteTenant } from '@/site-config/load';

export async function generateMetadata({ params, searchParams }: PageProps<'/t/[tenant]/[slug]'>): Promise<Metadata> {
  const { tenant: key, slug } = await params;
  const tenant = await requireSiteTenant(key);
  const route = await resolveListingRoute(slug, tenant.settings.service_area);
  if (!route) return {};
  const query = parseListingQuery(await searchParams, route.preset);
  const filtered = countActiveFilters(query, route.preset) > 0 || query.sort !== 'yeni';
  const pageSuffix = query.page > 1 ? ` – Sayfa ${query.page}` : '';
  const canonical = query.page > 1 && !filtered ? `${route.path}?sayfa=${query.page}` : route.path;
  const og = siteOgImage(tenant);
  return {
    title: `${route.heading}${pageSuffix}`,
    description: route.description,
    alternates: { canonical },
    // Filtre kombinasyonları dizine eklenmez (yinelenen içerik önlenir); bağlantılar izlenir
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { type: 'website', ...baseOpenGraph(tenant), title: route.heading, description: route.description, url: route.path, images: [og] },
    twitter: { card: 'summary_large_image', title: route.heading, description: route.description, images: [og] },
  };
}

export default async function ListingPage({ params, searchParams }: PageProps<'/t/[tenant]/[slug]'>) {
  const { tenant: key, slug } = await params;
  const tenant = await requireSiteTenant(key);
  const route = await resolveListingRoute(slug, tenant.settings.service_area);

  if (!route) {
    const target = await findRedirect(tenant.id, `/${slug}`);
    if (target) followRedirect(target);
    notFound();
  }

  const sp = await searchParams;
  const query = parseListingQuery(sp, route.preset);

  // Filtreler bir SEO yoluna karşılık geliyorsa oraya yönlendir (ör. /ilanlar?tip=satilik → /satilik)
  if (route.kind === 'listing') {
    const target = listingHref(query);
    if (target.split('?')[0] !== route.path) redirect(target);
  }

  const [result, options, regionPages] = await Promise.all([
    searchProperties(tenant.id, query),
    getSearchOptions(tenant.id),
    route.kind === 'region' ? getRegionPages(tenant.id) : Promise.resolve([]),
  ]);

  if (query.page > 1 && result.pageCount > 0 && query.page > result.pageCount) {
    redirect(listingHref({ ...query, page: result.pageCount }));
  }

  const regionPage = route.region
    ? regionPages.find(
        (r) =>
          r.citySlug === route.region?.city.slug &&
          r.districtSlug === (route.region.district?.slug ?? null) &&
          r.neighborhoodSlug === (route.region.neighborhood?.slug ?? null),
      )
    : undefined;

  const hrefFor = (page: number) => {
    if (route.kind === 'region') {
      const p = listingQueryToParams({ ...query, page }, route.preset).toString();
      return p ? `${route.path}?${p}` : route.path;
    }
    return listingHref({ ...query, page });
  };

  const view = await getSiteView(tenant);
  return (
    <SiteListing
      tenant={tenant}
      view={view}
      data={{ route, query, options, result, regionPage: regionPage ? { slug: regionPage.slug, name: regionPage.name } : null, hrefFor }}
    />
  );
}
