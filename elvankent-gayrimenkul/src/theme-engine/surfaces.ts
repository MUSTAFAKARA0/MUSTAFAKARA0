/**
 * Herkese açık sitenin yüzeyleri ve her yüzeyin tasarım kararının manifestteki yeri
 * (bağımlılıksız). Tasarım ailesi sözleşmesi bu yüzeyler üzerinden tanımlanır: Site Factory
 * ailenin kararlarını bu alanlara derler (compileManifest), Site Engine'in desen çözümleyicisi
 * aynı alanlardan okur (components/patterns/resolver.ts).
 */
export const SITE_SURFACES = ['home', 'navigation', 'footer', 'search', 'listing', 'property-detail', 'gallery', 'map'] as const;
export type SiteSurface = (typeof SITE_SURFACES)[number];

/** style.<alan> (tema varsayılanı olan kararlar) veya style.slots.<alan> (varsayılan: standard) */
export type SurfaceSetting =
  | { in: 'style'; key: 'hero' | 'headerLayout' | 'footerLayout' }
  | { in: 'slots'; key: 'search' | 'grid' | 'listingDetail' | 'gallery' | 'mapList' };

export const SURFACE_SETTINGS: Record<SiteSurface, SurfaceSetting> = {
  home: { in: 'style', key: 'hero' },
  navigation: { in: 'style', key: 'headerLayout' },
  footer: { in: 'style', key: 'footerLayout' },
  search: { in: 'slots', key: 'search' },
  listing: { in: 'slots', key: 'grid' },
  'property-detail': { in: 'slots', key: 'listingDetail' },
  gallery: { in: 'slots', key: 'gallery' },
  map: { in: 'slots', key: 'mapList' },
};
