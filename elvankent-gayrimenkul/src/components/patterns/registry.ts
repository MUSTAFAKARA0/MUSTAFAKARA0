import { CARD_LAYOUTS, FOOTER_LAYOUTS, GALLERY_LAYOUTS, GRID_LAYOUTS, HEADER_LAYOUTS, HERO_LAYOUTS, INTERACTION_PATTERNS, LISTING_DETAIL_LAYOUTS, MAP_LIST_LAYOUTS, NAVIGATION_STYLES, SEARCH_STYLES } from '@/theme-engine/ids';
import type { PatternKind, PatternMeta } from '@/components/patterns/contracts';

/**
 * Desen kaydı — YALNIZCA VERİ (bileşen içe aktarmaz; içe aktarsaydı kayıt tarayıcı paketine
 * bütün desenleri taşırdı). Manifestin kapalı listeleri (theme-engine/ids.ts) ile bu kayıt
 * birebir eşleşir: her manifest değerinin bir uygulaması, her uygulamanın bir manifest değeri
 * vardır (tests/unit/patterns.test.mjs).
 */
const legacy = (kind: PatternKind, ids: readonly string[], source: string): PatternMeta[] =>
  ids.map((id) => ({ kind, id, label: id, interactive: false, source, legacy: true }));

/** D7 deseni: işaret = karay-pattern:<tür>/<kimlik> (sunucu deseninde HTML'de data-pattern, adada JS'te) */
const pattern = (kind: PatternKind, id: string, label: string, opts: { interactive?: boolean; needs?: PatternMeta['needs'] } = {}): PatternMeta => ({
  kind,
  id,
  label,
  interactive: opts.interactive ?? false,
  marker: `karay-pattern:${kind}/${id}`,
  source: `components/patterns/${kind}/${id}.tsx`,
  ...(opts.needs ? { needs: opts.needs } : {}),
});

const LEGACY_HERO = ['overlay', 'centered', 'split', 'cinematic', 'editorial', 'showcase'] as const;
const LEGACY_HEADER = ['classic', 'centered', 'floating'] as const;
const LEGACY_FOOTER = ['classic', 'contact', 'minimal'] as const;

export const PATTERN_REGISTRY: readonly PatternMeta[] = [
  // Mevcut (kilitli) uygulamalar
  ...legacy('hero', LEGACY_HERO, 'components/home/hero.tsx'),
  ...legacy('header', LEGACY_HEADER, 'components/layout/site-header.tsx'),
  ...legacy('listing-card', CARD_LAYOUTS, 'components/property/property-card.tsx'),
  ...legacy('footer', LEGACY_FOOTER, 'components/layout/site-footer.tsx'),
  ...legacy('gallery', ['standard'], 'components/gallery/property-gallery.tsx'),
  ...legacy('search', ['standard'], 'components/search/listing-toolbar.tsx'),
  ...legacy('property-detail', ['standard'], 'components/property/property-detail-view.tsx'),
  ...legacy('navigation', NAVIGATION_STYLES, 'components/layout/site-header.tsx'),
  ...legacy('listing', ['standard'], 'components/property/property-grid.tsx'),
  ...legacy('map', ['standard'], 'components/common/maps/lazy-map.tsx'),
  // D7: etkileşim adaları (istemci tarafı tembel yükleme)
  pattern('interaction', 'scroll-header', 'Kaydırınca belirginleşen header', { interactive: true }),
  pattern('interaction', 'image-reveal', 'Görsel yüklenince yumuşak beliriş', { interactive: true }),
  // D7.2: galeri varyantları (istemci tarafı tembel yükleme: patterns/gallery/islands.tsx)
  pattern('gallery', 'grid', 'Eşit karolu, numaralı galeri ızgarası', { interactive: true }),
  pattern('gallery', 'carousel', 'Kaydırmalı galeri (küçük resim şeridi)', { interactive: true }),
  // D7.3: aile desenleri — kimlik yapıyı anlatır (bir desen birden fazla ailede kullanılabilir)
  pattern('hero', 'immersive', 'Kenardan kenara görsel, az metin, tek çağrı'),
  pattern('hero', 'blueprint', 'Izgaralı, numaralı kategori dizini + çerçeveli görsel'),
  pattern('hero', 'map-search', 'Arama öncelikli, bölge + ilan sayısı dizini'),
  pattern('search', 'map-first', 'Yapışkan filtre çubuğu + ilçe kısayolları'),
  pattern('listing', 'gallery-wide', 'İki sütunlu geniş görselli seçki'),
  pattern('listing', 'ruled-index', 'Çizgili, numaralı mimari dizin'),
  pattern('listing', 'map-results', 'Liste ↔ harita (masaüstü yan yana, mobilde geçiş)', { interactive: true, needs: ['map-points'] }),
  pattern('property-detail', 'immersive', 'Tam genişlik galeri, editoryal tek sütun'),
  pattern('property-detail', 'information-first', 'Teknik künye öncelikli iki sütun'),
  pattern('property-detail', 'map-first', 'Konum ve bölge bağlamı öncelikli'),
  pattern('gallery', 'fullscreen', 'Kenardan kenara sinematik galeri', { interactive: true }),
  pattern('map', 'map-first', 'Geniş harita + bölge bağlantıları'),
  // D7.4: header ve footer desenleri (sunucu bileşeni; istemci parçaları mevcut header-client)
  pattern('header', 'transparent', 'Hero üzerinde saydam, ortalı logo, düşük yoğunluk'),
  pattern('header', 'structured', 'Çizgili ızgara hücreleri, üstte iletişim şeridi'),
  pattern('header', 'search-bar', 'Header içinde ilan araması ve hızlı keşif bağlantıları'),
  pattern('footer', 'editorial', 'Büyük marka cümlesi, tek çağrı, sade bağlantı satırı'),
  pattern('footer', 'structured', 'Numaralı, çizgili sütunlar ve künye tipi iletişim'),
  pattern('footer', 'discovery', 'Bölge ve ilan türü kısayollarıyla kompakt keşif'),
];

/** Manifest kapalı listeleri (desen türü → izin verilen kimlikler) */
export const PATTERN_ENUMS: Partial<Record<PatternKind, readonly string[]>> = {
  hero: HERO_LAYOUTS,
  header: HEADER_LAYOUTS,
  'listing-card': CARD_LAYOUTS,
  footer: FOOTER_LAYOUTS,
  gallery: GALLERY_LAYOUTS,
  listing: GRID_LAYOUTS,
  map: MAP_LIST_LAYOUTS,
  search: SEARCH_STYLES,
  'property-detail': LISTING_DETAIL_LAYOUTS,
  navigation: NAVIGATION_STYLES,
  interaction: INTERACTION_PATTERNS,
};

export function findPattern(kind: PatternKind, id: string): PatternMeta | null {
  return PATTERN_REGISTRY.find((p) => p.kind === kind && p.id === id) ?? null;
}
