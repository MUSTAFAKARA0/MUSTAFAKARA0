import { Pagination } from '@/components/common/pagination';
import type { ListingResultsPatternProps } from '@/components/patterns/contracts';
import { GalleryWideListing } from '@/components/patterns/listing/gallery-wide';
import { ListingIsland } from '@/components/patterns/listing/islands';
import { RuledIndexListing } from '@/components/patterns/listing/ruled-index';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';
import { PropertyGrid } from '@/components/property/property-grid';
import { publicMapConfig } from '@/modules/maps/providers';

/**
 * İlan sonuçları yüzeyi (sunucu). Standart → mevcut ızgara + sayfalama (değişmeden).
 * Sunucu desenleri doğrudan; interaktif Map First deseni yalnızca istemci yükleyicisinden.
 * Sonuçlar ve harita konumları veri katmanından hazır gelir.
 */
export function ListingResultsSurface({ view, items, mapPoints, page, pageCount, hrefFor, priorityCount }: ListingResultsPatternProps & { view?: PatternView | null }) {
  const pagination = <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />;
  switch (resolvePattern(view, 'listing').id) {
    case 'gallery-wide':
      return <GalleryWideListing items={items} page={page} pageCount={pageCount} hrefFor={hrefFor} priorityCount={priorityCount} />;
    case 'ruled-index':
      return <RuledIndexListing items={items} page={page} pageCount={pageCount} hrefFor={hrefFor} priorityCount={priorityCount} />;
    case 'map-results': {
      const map = publicMapConfig();
      return (
        <ListingIsland id="map-results" items={items} points={mapPoints ?? []} attribution={map.attribution} maxZoom={map.maxZoom}>
          {pagination}
        </ListingIsland>
      );
    }
    default:
      return (
        <>
          <PropertyGrid items={items} priorityCount={priorityCount} />
          {pagination}
        </>
      );
  }
}
