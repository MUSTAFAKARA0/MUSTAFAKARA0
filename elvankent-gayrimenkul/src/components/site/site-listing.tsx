import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Breadcrumbs } from '@/components/common/breadcrumbs';
import { EmptyState } from '@/components/common/empty-state';
import { ListingResultsSurface } from '@/components/patterns/listing/surface';
import type { PatternView } from '@/components/patterns/resolver';
import { ListingSearchSurface } from '@/components/patterns/search/surface';
import { ListingResults, ListingSearchProvider } from '@/components/search/search-context';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import type { ListingQuery } from '@/modules/properties/filters';
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
}

export function SiteListing({ tenant, view, data }: { tenant: Tenant; view: PatternView | null; data: ListingPageData }) {
  const { route, query, options, result, regionPage, hrefFor } = data;
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

      <section id="sonuclar" aria-label="Arama sonuçları" className="container-page scroll-mt-24 py-10 sm:py-14">
        <ListingResults>
          {result.items.length > 0 ? (
            <ListingResultsSurface view={view} items={result.items} page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} priorityCount={2} />
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
