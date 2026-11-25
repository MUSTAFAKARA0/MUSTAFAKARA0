import Link from 'next/link';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { emptySuggestions } from '@/components/common/empty-state-copy';
import { ContextEmptyState } from '@/components/common/empty-state-variants';
import { ListingResultsSurface } from '@/components/patterns/listing/surface';
import type { MapPoint } from '@/components/patterns/contracts';
import type { PatternView } from '@/components/patterns/resolver';
import { ListingSearchSurface } from '@/components/patterns/search/surface';
import { ListingResults, ListingSearchProvider } from '@/components/search/search-context';
import { FLAG_KEYS } from '@/components/search/filter-state';
import { formatNumber } from '@/lib/format';
import { countActiveFilters, type ListingQuery } from '@/modules/properties/filters';
import type { SearchResult } from '@/modules/properties/queries';
import type { ListingRoute } from '@/modules/properties/routes';
import type { SearchOptions } from '@/modules/properties/search-types';
import type { Tenant } from '@/platform/tenant/tenant';

/**
 * SITE RENDERER SÖZLEŞMESİ › ilan listesi / arama sayfası gövdesi. Kiracı sitesi
 * (app/t/[tenant]/[slug]) gerçek arama sonucuyla, önizlemeler aynı bileşeni kendi verisiyle
 * çağırır. Arama ve sonuç alanları manifestin seçtiği desenlerle çizilir (patterns/*\/surface.tsx);
 * veri (sorgu, sonuç, seçenekler) yalnızca prop olarak gelir.
 */
export interface ListingPageData {
  route: Pick<ListingRoute, 'path' | 'label' | 'heading' | 'description' | 'preset'>;
  query: ListingQuery;
  options: SearchOptions;
  result: SearchResult;
  regionPage: { slug: string; name: string } | null;
  hrefFor: (page: number) => string;
  /** Yalnızca seçili desen istediğinde (patternNeeds 'map-points') veri katmanından */
  mapPoints?: MapPoint[];
}

export function SiteListing({ tenant, view, data }: { tenant: Tenant; view: PatternView | null; data: ListingPageData }) {
  const { route, query, options, result, regionPage, hrefFor, mapPoints } = data;
  // Rota ön ayarı (/kiralik-arsa vb.) etkin filtredir; temizleme ön ayarı da kaldırır (yoksa aynı boş sayfaya döner)
  const extras = countActiveFilters(query, route.preset) > 0 || Boolean(query.q);
  const presetOnly = !extras && Boolean(route.preset.listingType || route.preset.category || route.preset.types?.length);
  const filtered = extras || presetOnly;
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
            <ListingSearchSurface view={view} query={query} preset={route.preset} options={options} />
          </div>
        </div>
      </div>

      <section id="sonuclar" aria-labelledby="sonuclar-baslik" className="container-page scroll-mt-24 py-10 sm:py-14">
        {/* Başlık sırası h1 → h2 → (ilan kartı) h3: ekran okuyucu gezintisi için görünmez bölüm başlığı */}
        <h2 id="sonuclar-baslik" className="sr-only">
          Arama sonuçları
        </h2>
        <ListingResults>
          {result.items.length > 0 ? (
            <ListingResultsSurface view={view} items={result.items} mapPoints={mapPoints} page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} priorityCount={2} />
          ) : (
            <ContextEmptyState
              variant={filtered ? 'filtered' : 'no-listings'}
              suggestions={filtered ? emptySuggestions({ ...query, flagCount: FLAG_KEYS.filter((k) => query[k]).length }) : []}
              clearHref={extras ? route.path : presetOnly ? '/ilanlar' : undefined}
            />
          )}
        </ListingResults>
      </section>
    </ListingSearchProvider>
  );
}
