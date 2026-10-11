import { LazyMap } from '@/components/common/maps/lazy-map';
import type { MapPatternProps } from '@/components/patterns/contracts';
import { MapFirstMap } from '@/components/patterns/map/map-first';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';

/**
 * Harita yüzeyi (sunucu) — Map First altyapısı. Harita arka ucu (sağlayıcı, karo sunucusu,
 * Leaflet) ve mevcut harita bileşeni DEĞİŞMEZ; desen yalnızca sunumu seçer. Çok işaretli sonuç
 * haritası ilan listesi desenidir (listing/map-results) ve yalnızca istemci yükleyicisinden iner.
 */
export function MapSurface({ view, area, ...props }: MapPatternProps & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'map').id) {
    case 'map-first':
      return <MapFirstMap {...props} area={area} />;
    default:
      return <LazyMap {...props} />;
  }
}
