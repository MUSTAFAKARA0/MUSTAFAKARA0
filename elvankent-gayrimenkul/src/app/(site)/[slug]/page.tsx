import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { PropertyGrid } from '@/components/property/property-grid';
import { DesktopFilters, MobileFilters, SortSelect } from '@/components/property/property-filters';
import { ListingNavigationProvider, ListingResults } from '@/components/property/listing-navigation';
import { SORT_OPTIONS, type SortValue } from '@/lib/constants';
import { findRedirect, getRegionCounts, searchProperties } from '@/lib/data/properties';
import { resolveListingRoute } from '@/lib/data/listing-routes';
import { getTaxonomy } from '@/lib/data/taxonomy';
import { regionPath } from '@/lib/data/regions';
import { countActiveFilters, filtersToSearchParams, parseListingFilters } from '@/lib/listing-filters';
import { formatNumber } from '@/lib/format';

type Props = PageProps<'/[slug]'>;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const route = await resolveListingRoute(slug);
  if (!route) return { title: 'Sayfa bulunamadı', robots: { index: false } };
  const filters = parseListingFilters(await searchParams, route.preset);
  const filtered = countActiveFilters(filters, route.preset) > 0 || filters.sort !== 'yeni';
  const canonical = filters.page > 1 ? `${route.path}?sayfa=${filters.page}` : route.path;
  const title = filters.page > 1 ? `${route.heading} – Sayfa ${filters.page}` : route.heading;
  return {
    title,
    description: route.description,
    alternates: { canonical },
    // Filtre kombinasyonları ince/tekrarlı içerik üretmesin diye indekslenmez
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title, description: route.description, url: canonical },
  };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const route = await resolveListingRoute(slug);

  if (!route) {
    const r = await findRedirect(`/${slug}`);
    if (r) (r.status_code === 301 || r.status_code === 308 ? permanentRedirect : redirect)(r.to_path);
    notFound();
  }

  const sp = await searchParams;
  const filters = parseListingFilters(sp, route.preset);
  const [result, tax, regionCounts] = await Promise.all([
    searchProperties(filters),
    getTaxonomy(),
    route.kind === 'region' ? getRegionCounts() : Promise.resolve([]),
  ]);

  // Bölge sayfası: hiç aktif ilanı olmayan bölge için boş sayfa üretme (ince içerik)
  if (route.kind === 'region' && route.region) {
    const reg = route.region;
    const hasListings = regionCounts.some(
      (r) =>
        r.city_slug === reg.city.slug &&
        (!reg.district || r.district_slug === reg.district.slug) &&
        (!reg.neighborhood || r.neighborhood_slug === reg.neighborhood.slug),
    );
    if (!hasListings) notFound();
  }

  const activeCount = countActiveFilters(filters, route.preset);
  const hrefWith = (overrides: Partial<typeof filters>) => {
    const qs = filtersToSearchParams({ ...filters, ...overrides }, route.preset).toString();
    return qs ? `${route.path}?${qs}` : route.path;
  };
  const sortHrefs = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, hrefWith({ sort: o.value, page: 1 })])) as Record<
    SortValue,
    string
  >;

  const crumbs = [{ name: 'Ana Sayfa', path: '/' }];
  if (route.region) {
    const { city, district, neighborhood } = route.region;
    crumbs.push({ name: city.name, path: regionPath(city.slug) });
    if (district) crumbs.push({ name: district.name, path: regionPath(city.slug, district.slug) });
    if (district && neighborhood) crumbs.push({ name: neighborhood.name, path: regionPath(city.slug, district.slug, neighborhood.slug) });
  } else {
    crumbs.push({ name: route.label, path: route.path });
  }

  // Bölge sayfasında alt bölgelere bağlantılar (yalnızca ilanı olanlar)
  const subRegions =
    route.region && !route.region.neighborhood
      ? regionCounts
          .filter((r) =>
            route.region!.district
              ? r.district_slug === route.region!.district.slug && r.neighborhood_slug
              : r.city_slug === route.region!.city.slug,
          )
          .reduce<{ name: string; path: string; count: number }[]>((acc, r) => {
            const isNeighborhood = Boolean(route.region!.district);
            const name = isNeighborhood ? r.neighborhood_name! : r.district_name;
            const path = isNeighborhood
              ? regionPath(r.city_slug, r.district_slug, r.neighborhood_slug!)
              : regionPath(r.city_slug, r.district_slug);
            const existing = acc.find((x) => x.path === path);
            if (existing) existing.count += r.listing_count;
            else acc.push({ name, path, count: r.listing_count });
            return acc;
          }, [])
      : [];

  const filterProps = {
    filters,
    preset: route.preset,
    basePath: route.kind === 'region' ? route.path : undefined,
    options: {
      cities: tax.cities,
      districts: tax.districts,
      neighborhoods: tax.neighborhoods,
      propertyTypes: tax.propertyTypes,
    },
  };

  return (
    <div className="container-page pt-6 pb-4 sm:pt-8">
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 max-w-3xl">
        <h1 className="font-display text-[1.75rem] leading-tight text-ink sm:text-4xl">{route.heading}</h1>
        <p className="mt-2 text-[15px] text-sand-600">{route.description}</p>
      </header>

      {subRegions.length > 0 && (
        <nav aria-label="Alt bölgeler" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            {subRegions.map((r) => (
              <li key={r.path}>
                <Link
                  href={r.path}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-sand-700 ring-1 ring-line transition hover:text-brand-800 hover:ring-brand-300"
                >
                  {r.name} <span className="text-sand-500">{r.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ListingNavigationProvider>
        <div className="mt-7 grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] xl:grid-cols-[18.5rem_minmax(0,1fr)]">
          <DesktopFilters {...filterProps} />
          <section id="sonuclar" aria-labelledby="sonuclar-baslik" className="min-w-0 scroll-mt-24">
            <h2 id="sonuclar-baslik" className="sr-only">
              İlan sonuçları
            </h2>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <MobileFilters {...filterProps} activeCount={activeCount} />
                <p className="text-sm text-sand-600" aria-live="polite">
                  <strong className="font-bold text-ink">{formatNumber(result.total)}</strong> ilan bulundu
                </p>
              </div>
              <SortSelect current={filters.sort} hrefFor={sortHrefs} />
            </div>

            <ListingResults>
              {result.items.length > 0 ? (
                <PropertyGrid properties={result.items} preloadFirst={2} />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="Aradığınız kriterlere uygun ilan bulunamadı."
                  description="Filtreleri genişleterek veya farklı bir bölge seçerek tekrar deneyebilirsiniz. Aradığınız özellikte bir mülk için bize ulaşın; portföyümüze yeni eklenen ilanlardan sizi haberdar edelim."
                  action={
                    <>
                      <Button asChild>
                        <Link href={route.path}>Arama kriterlerini sıfırla</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/iletisim">Bize ulaşın</Link>
                      </Button>
                    </>
                  }
                />
              )}
            </ListingResults>

            <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => hrefWith({ page })} />
          </section>
        </div>
      </ListingNavigationProvider>
    </div>
  );
}
