import { Pagination } from '@/components/common/pagination';
import type { ListingResultsPatternProps } from '@/components/patterns/contracts';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';
import { PropertyGrid } from '@/components/property/property-grid';

/**
 * İlan sonuçları yüzeyi (sunucu). Bugün yalnızca standart (mevcut ızgara + sayfalama);
 * sözleşmesi hazır desenler: surfaces.ts › listing.planned. Sonuçlar veri katmanından gelir.
 */
export function ListingResultsSurface({ view, items, page, pageCount, hrefFor, priorityCount }: ListingResultsPatternProps & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'listing').id) {
    default:
      return (
        <>
          <PropertyGrid items={items} priorityCount={priorityCount} />
          <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
        </>
      );
  }
}
