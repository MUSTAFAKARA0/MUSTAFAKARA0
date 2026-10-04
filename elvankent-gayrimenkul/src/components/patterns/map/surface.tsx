import { LazyMap } from '@/components/common/maps/lazy-map';
import type { MapPatternProps } from '@/components/patterns/contracts';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';

/**
 * Harita yüzeyi (sunucu) — Map First altyapısı. Harita arka ucu (sağlayıcı, karo sunucusu,
 * Leaflet) ve mevcut harita bileşeni DEĞİŞMEZ; desen yalnızca sunumu seçer. Bugün yalnızca
 * standart (tembel yüklenen mevcut harita). 'map-first' gibi interaktif desenler yalnızca bir
 * istemci yükleyicisinden yüklenir (D7.0 kuralı) ve onu seçmeyen siteye inmez.
 */
export function MapSurface({ view, ...props }: MapPatternProps & { view?: PatternView | null }) {
  switch (resolvePattern(view, 'map').id) {
    default:
      return <LazyMap {...props} />;
  }
}
