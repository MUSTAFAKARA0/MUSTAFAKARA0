import type { ListingSearchPatternProps } from '@/components/patterns/contracts';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';
import { MapFirstSearch } from '@/components/patterns/search/map-first';
import { ActiveFilterChips, ListingToolbar } from '@/components/search/listing-toolbar';

/**
 * Arama yüzeyi (sunucu): ilan listesi sayfasının arama/filtre alanı. Standart → mevcut filtre
 * çubuğu (değişmeden). Sözleşmesi hazır diğer desenler: surfaces.ts › search.planned.
 */
export function ListingSearchSurface({ view, query, preset, options }: ListingSearchPatternProps & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'search').id) {
    case 'map-first':
      return <MapFirstSearch query={query} preset={preset} options={options} />;
    default:
      return (
        <>
          <ListingToolbar query={query} preset={preset} options={options} />
          <ActiveFilterChips query={query} preset={preset} options={options} />
        </>
      );
  }
}
