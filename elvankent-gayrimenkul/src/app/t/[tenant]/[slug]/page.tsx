import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { PropertyGrid } from '@/components/property/property-grid';
import { ActiveFilterChips, ListingToolbar } from '@/components/search/listing-toolbar';
import { ListingResults, ListingSearchProvider } from '@/components/search/search-context';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { getRegionPages } from '@/modules/content/queries';
import { countActiveFilters, listingHref, listingQueryToParams, parseListingQuery } from '@/modules/properties/filters';
import { findRedirect, searchProperties } from '@/modules/properties/queries';
import { followRedirect } from '@/modules/seo/redirects';
import { resolveListingRoute } from '@/modules/properties/routes';
import { getSearchOptions } from '@/modules/properties/search-options';
import { baseOpenGraph, siteOgImage } from '@/modules/seo/og';
import { requireSiteTenant } from '@/site-config/load';

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

  return (
    <ListingSearchProvider>
      <div className="border-b border-border bg-surface">
        <div className="container-page pt-7 pb-6 sm:pt-9">
          <Breadcrumbs
            tenant={tenant}
            items={[
              { name: 'Ana sayfa', path: '/' },
              ...(route.path !== '/ilanlar' ? [{ name: 'İlanlar', path: '/ilanlar' }] : []),
              { name: route.label, path: route.path },
            ]}
          />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h1 className="font-display text-display-xl text-foreground">{route.heading}</h1>
            <p className="numeric text-[15px] text-muted-foreground" aria-live="polite">
              <strong className="font-semibold text-foreground">{formatNumber(result.total)}</strong> ilan
            </p>
          </div>
          <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-muted-foreground">{route.description}</p>
          {regionPage && (
            <p className="mt-3 text-sm">
              <Link href={`/bolgeler/${regionPage.slug}`} className="font-semibold text-primary-ink hover:underline">
                {regionPage.name} bölge rehberi →
              </Link>
            </p>
          )}
          <div className="mt-7">
            <ListingToolbar query={query} preset={route.preset} options={options} />
            <ActiveFilterChips query={query} preset={route.preset} options={options} />
          </div>
        </div>
      </div>

      <section id="sonuclar" aria-label="Arama sonuçları" className="container-page scroll-mt-24 py-10 sm:py-14">
        <ListingResults>
          {result.items.length > 0 ? (
            <>
              <PropertyGrid items={result.items} priorityCount={2} />
              <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
            </>
          ) : (
            <EmptyState
              icon={SearchX}
              title="Hiç ilan bulunamadı"
              description="Seçtiğiniz kriterlere uygun yayında ilan yok. Filtreleri genişletebilir veya aradığınız gayrimenkulü bize iletebilirsiniz; uygun bir seçenek olduğunda size haber verelim."
              action={
                <>
                  <Button asChild>
                    <Link href={route.path}>Filtreleri temizle</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/iletisim">Aradığımı bildir</Link>
                  </Button>
                </>
              }
            />
          )}
        </ListingResults>
      </section>
    </ListingSearchProvider>
  );
}
