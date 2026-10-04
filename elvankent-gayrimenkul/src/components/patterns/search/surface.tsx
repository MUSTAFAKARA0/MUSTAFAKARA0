import type { ListingSearchPatternProps } from '@/components/patterns/contracts';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';
import { ActiveFilterChips, ListingToolbar } from '@/components/search/listing-toolbar';

/**
 * Arama yüzeyi (sunucu): ilan listesi sayfasının arama/filtre alanı. Bugün yalnızca standart
 * (mevcut filtre çubuğu) uygulanmıştır; sözleşmesi hazır desenler: surfaces.ts › search.planned.
 * Yeni desen = yeni dal (sunucu deseni doğrudan, interaktif desen istemci yükleyicisinden).
 */
export function ListingSearchSurface({ view, query, preset, options }: ListingSearchPatternProps & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'search').id) {
    default:
      return (
        <>
          <ListingToolbar query={query} preset={preset} options={options} />
          <ActiveFilterChips query={query} preset={preset} options={options} />
        </>
      );
  }
}
