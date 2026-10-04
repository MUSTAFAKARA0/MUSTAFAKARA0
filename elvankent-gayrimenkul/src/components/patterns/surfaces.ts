import type { PatternKind } from '@/components/patterns/contracts';
import { SITE_SURFACES, SURFACE_SETTINGS, type SiteSurface, type SurfaceSetting } from '@/theme-engine/surfaces';

export { SITE_SURFACES, type SiteSurface };

/**
 * TASARIM AİLESİ SÖZLEŞMESİ — yüzeyler (D7.2). Bir tasarım ailesi yalnızca ana sayfayı değil,
 * herkese açık sitenin GERÇEK yüzeylerini tanımlar. Her yüzey için aile tek bir karar verir:
 * hangi desen (pattern) o yüzeyi çizer. Karar sitenin manifestinde (site_configs.style) saklanır:
 *
 *   yüzey            desen türü        manifest alanı           kararı yoksa (fallback)
 *   home             hero              style.hero               temanın hero düzeni
 *   navigation       header            style.headerLayout       temanın header düzeni
 *   footer           footer            style.footerLayout       temanın footer düzeni
 *   search           search            style.slots.search       standard (mevcut filtre çubuğu)
 *   listing          listing           style.slots.grid         standard (mevcut ilan ızgarası)
 *   property-detail  property-detail   style.slots.listingDetail standard (mevcut detay sayfası)
 *   gallery          gallery           style.slots.gallery      standard (mevcut galeri)
 *   map              map               style.slots.mapList      standard (mevcut harita)
 *
 * YALNIZCA VERİ: bileşen içe aktarmaz. Çözümleme sunucudadır (patterns/resolver.ts).
 *
 * `planned`: sözleşmesi (props tipi, yeri, test altyapısı) hazır, uygulaması henüz olmayan
 * desenler. Manifestte SEÇİLEMEZ (kapalı listede yoklar); uygulandığında kimlik buradan
 * theme-engine/ids.ts kapalı listesine ve desen kaydına taşınır (tests/unit/patterns.test.mjs
 * ikisinin kesişmediğini doğrular).
 */
export interface SurfaceContract {
  surface: SiteSurface;
  kind: PatternKind;
  setting: SurfaceSetting;
  /** Herkese açık sitede yüzeyin çizildiği rotalar (belgeleme ve önizleme) */
  routes: readonly string[];
  /** Sözleşmesi hazır, uygulaması sonraki aşamada (seçilemez) */
  planned: readonly string[];
}

export const SURFACE_CONTRACTS: readonly SurfaceContract[] = [
  { surface: 'home', kind: 'hero', setting: SURFACE_SETTINGS.home, routes: ['/'], planned: [] },
  { surface: 'navigation', kind: 'header', setting: SURFACE_SETTINGS.navigation, routes: ['*'], planned: [] },
  { surface: 'footer', kind: 'footer', setting: SURFACE_SETTINGS.footer, routes: ['*'], planned: [] },
  {
    surface: 'search',
    kind: 'search',
    setting: SURFACE_SETTINGS.search,
    routes: ['/ilanlar', '/[ilan-listesi]'],
    // standard = klasik filtre çubuğu
    planned: ['premium', 'sidebar', 'map-first', 'filter-sheet', 'compact'],
  },
  {
    surface: 'listing',
    kind: 'listing',
    setting: SURFACE_SETTINGS.listing,
    routes: ['/ilanlar', '/[ilan-listesi]'],
    // standard = ızgara
    planned: ['compact', 'horizontal', 'featured', 'map-results'],
  },
  {
    surface: 'property-detail',
    kind: 'property-detail',
    setting: SURFACE_SETTINGS['property-detail'],
    routes: ['/ilan/[slug]'],
    // standard = galeri öncelikli
    planned: ['information-first', 'editorial', 'map-first', 'immersive'],
  },
  {
    surface: 'gallery',
    kind: 'gallery',
    setting: SURFACE_SETTINGS.gallery,
    routes: ['/ilan/[slug]'],
    // standard = mozaik (büyük kapak + karolar); uygulanmış: grid, carousel
    planned: ['masonry', 'fullscreen', 'hero-thumbnails'],
  },
  {
    surface: 'map',
    kind: 'map',
    setting: SURFACE_SETTINGS.map,
    routes: ['/ilan/[slug]'],
    // standard = ilan konumu haritası (tembel yüklenen Leaflet)
    planned: ['map-first'],
  },
];

export function surfaceContract(surface: SiteSurface): SurfaceContract {
  return SURFACE_CONTRACTS.find((c) => c.surface === surface)!;
}
